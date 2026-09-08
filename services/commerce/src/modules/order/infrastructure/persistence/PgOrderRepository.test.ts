import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../../../platform/error/DomainError';
import { PgOrderRepository } from './PgOrderRepository';

describe('PgOrderRepository reminder authorization', () => {
  it('limits an operator reminder to descendant order scopes, valid lifecycle states and a server-side cooldown', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'reminder:one', order_id: 'order:one', member_id: 'member:one', kind: 'fulfillment', state: 'queued', created_at: '2026-09-05T00:00:00.000Z' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ existing: false, depth: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const descendants = vi.fn(async () => Object.freeze(['enterprise:one', 'mall:one']));
    const repository = new PgOrderRepository({ database: () => ({ query }) } as never, {} as never, { descendants } as never, { search: vi.fn(), profiles: vi.fn(async () => Object.freeze([])) });

    const result = await repository.schedule({} as never, { path: { orderid: 'order:one' }, body: {} } as never, execution('console', 'enterprise', 'enterprise:one') as never);

    expect(result).toMatchObject({ status: 202, body: { id: 'reminder:one', order_id: 'order:one', state: 'queued' } });
    expect(descendants).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'enterprise:one');
    expect(query.mock.calls[0]?.[0]).toContain("orders.lifecycle_state in('paid','fulfilling','shipped')");
    expect(query.mock.calls[0]?.[0]).toContain("orders.fulfillment_state not in('received','cancelled','returned')");
    expect(query.mock.calls[0]?.[0]).toContain("interval '30 minutes'");
    expect(query.mock.calls[0]?.[1]?.slice(1)).toEqual(['order:one', 'enterprise:one', false, false, false, ['enterprise:one', 'mall:one']]);
    expect(query.mock.calls[1]?.[0]).toContain('select exists(select 1 from runtime.jobs');
    expect(query.mock.calls[2]?.[0]).toContain('insert into runtime.jobs');
    expect(query.mock.calls[2]?.[1]?.slice(1, 4)).toEqual(['notification', 'notification', 'enterprise:one']);
  });

  it('returns a stable domain failure when the order is invisible, terminal or still cooling down', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repository = new PgOrderRepository({ database: () => ({ query }) } as never, {} as never, { descendants: vi.fn() } as never, { search: vi.fn(), profiles: vi.fn(async () => Object.freeze([])) });

    await expect(repository.schedule({} as never, { path: { orderid: 'order:two' }, body: {} } as never, execution('storefront', 'owner', 'member:one') as never)).rejects.toEqual(new DomainError('ORDER_REMINDER_NOT_ALLOWED'));
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]?.slice(1)).toEqual(['order:two', 'member:one', true, false, false, []]);
  });
});

describe('PgOrderRepository list facets', () => {
  it('computes scoped state counts and projection watermarks in parallel with the page', async () => {
    const watermark = new Date('2026-09-05T02:00:00.000Z');
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) =>
      sql.includes('with visible as materialized')
        ? {
            rows: [
              { all: 8, unpaid: 1, unshipped: 2, active: 3, completed: 2, aftersale: 1, exception: 1, orderWatermark: watermark, paymentWatermark: watermark, fulfillmentWatermark: null, aftersaleWatermark: null, refundWatermark: null },
            ],
            rowCount: 1,
          }
        : { rows: [], rowCount: 0 }
    );
    const descendants = vi.fn(async () => Object.freeze(['enterprise:one', 'mall:one']));
    const repository = new PgOrderRepository({ database: () => ({ query }) } as never, {} as never, { descendants, scope: vi.fn() } as never, { search: vi.fn(), profiles: vi.fn(async () => Object.freeze([])) });

    const result = (await repository.read({} as never, { query: { limit: '50' } } as never, readExecution() as never)) as unknown as {
      body: { facets: { state: string; data: { counts: { exception: number }; watermarks: { order: string } } } };
    };

    expect(result.body.facets).toMatchObject({ state: 'ready', data: { counts: { exception: 1 }, watermarks: { order: watermark.toISOString() } } });
    expect(query).toHaveBeenCalledTimes(2);
    const facet = query.mock.calls.find(([sql]) => sql.includes('with visible as materialized'));
    const list = query.mock.calls.find(([sql]) => !sql.includes('with visible as materialized'));
    expect(facet?.[0]).toContain("verification_state<>'verified'");
    expect(list?.[0]).toContain("orders.aftersale_state in ('reviewing','refunding')");
    expect(list?.[0]).toContain("orders.verification_state<>'verified'");
    expect(facet?.[1]?.[6]).toBe('all');
  });

  it('keeps the list usable when only facet projections fail', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql.includes('with visible as materialized')) throw new Error('PROJECTION_TIMEOUT');
      return { rows: [], rowCount: 0 };
    });
    const repository = new PgOrderRepository(
      { database: () => ({ query }) } as never,
      {} as never,
      { descendants: vi.fn(async () => Object.freeze(['enterprise:one'])), scope: vi.fn(), summaries: vi.fn(async () => Object.freeze([])) },
      { search: vi.fn(), profiles: vi.fn(async () => Object.freeze([])) }
    );

    const result = (await repository.read({} as never, { query: { limit: '50' } } as never, readExecution() as never)) as unknown as { body: { items: unknown[]; facets: { state: string; error: { code: string } } } };

    expect(result.body.items).toEqual([]);
    expect(result.body.facets).toMatchObject({ state: 'unavailable', error: { code: 'ORDER_FACET_UNAVAILABLE' } });
  });

  it('canonicalizes top-level and nested PostgreSQL timestamps before contract validation', async () => {
    const query = vi.fn(async (sql: string) =>
      sql.includes('with visible as materialized')
        ? {
            rows: [{ all: 1, unpaid: 1, unshipped: 0, active: 0, completed: 0, aftersale: 0, exception: 0, orderWatermark: null, paymentWatermark: null, fulfillmentWatermark: null, aftersaleWatermark: null, refundWatermark: null }],
            rowCount: 1,
          }
        : {
            rows: [
              {
                id: 'order:one',
                created_at: new Date('2026-09-05T00:00:00.000Z'),
                updated_at: new Date('2026-09-05T00:01:00.000Z'),
                receivedAt: null,
                payment: { updatedAt: '2026-09-05T08:02:00+08:00' },
                fulfillments: [{ createdAt: '2026-09-05T00:03:00+00:00', updatedAt: '2026-09-05T00:04:00+00:00', milestones: [{ occurredAt: '2026-09-05T08:05:00+08:00' }] }],
                refunds: [],
              },
            ],
            rowCount: 1,
          }
    );
    const repository = new PgOrderRepository(
      { database: () => ({ query }) } as never,
      {} as never,
      {
        descendants: vi.fn(async () => Object.freeze(['enterprise:one'])),
        scope: vi.fn(),
        summaries: vi.fn(async () => Object.freeze([{ id: 'enterprise:one', name: '示例集团', kind: 'enterprise' }])),
      },
      { search: vi.fn(), profiles: vi.fn(async () => Object.freeze([{ member: 'member:one', displayName: '王小明', mobileMasked: null }])) }
    );

    const result = (await repository.read({} as never, { query: { limit: '50' } } as never, readExecution() as never)) as unknown as {
      body: { items: readonly Readonly<Record<string, unknown>>[] };
    };

    expect(result.body.items[0]).toMatchObject({
      member_name: '会员名称暂不可用',
      scope_name: '组织名称暂不可用',
      mall_name: '商城名称暂不可用',
      created_at: '2026-09-05T00:00:00.000Z',
      updated_at: '2026-09-05T00:01:00.000Z',
      payment: { updatedAt: '2026-09-05T00:02:00.000Z' },
      fulfillments: [{ createdAt: '2026-09-05T00:03:00.000Z', updatedAt: '2026-09-05T00:04:00.000Z', milestones: [{ occurredAt: '2026-09-05T00:05:00.000Z' }] }],
    });
  });
});

function execution(target: 'console' | 'storefront', kind: 'enterprise' | 'owner', scope: string) {
  return {
    requestId: 'request:one',
    traceId: 'trace:one',
    deadline: Date.now() + 1_000,
    signal: new AbortController().signal,
    operation: 'order.reminders.create',
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target, assurance: { level: 1 } },
        membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(['order.reminder.create']), denies: new Set() }, scopes: [] },
        roles: [],
        organization: target === 'storefront' ? 'mall:one' : 'enterprise:one',
        scope: { id: scope, kind, path: [] },
        accessVersion: 1,
        capabilities: new Set(['order.reminders.create']),
        capabilityVersion: 1,
        assurance: { level: 1 },
        trace: 'trace:one',
      },
    },
    headers: {},
    rawBody: '{}',
    idempotencyKey: 'idem-one',
  } as const;
}

function readExecution() {
  return { ...execution('console', 'enterprise', 'enterprise:one'), operation: 'order.orders.read', idempotencyKey: undefined } as const;
}
