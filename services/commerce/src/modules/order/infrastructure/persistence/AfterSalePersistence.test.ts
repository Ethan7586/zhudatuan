import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationRequest';
import { AfterSalePersistence } from './AfterSalePersistence';

describe('AfterSalePersistence read scope', () => {
  it('uses the organization closure for console lists and does not require an order id', async () => {
    const descendants = vi.fn(async () => Object.freeze(['enterprise:one', 'mall:one']));
    const query = vi.fn(async (_sql: string, _values: readonly unknown[]) => ({ rows: [], rowCount: 0 }));
    const service = new AfterSalePersistence({ evaluate: vi.fn() } as never, { descendants } as never, { search: vi.fn() });

    const result = await service.read(request('console', 'enterprise', 'enterprise:one'), { query, transaction: {} } as never);

    expect(result).toEqual({ status: 200, body: { items: [], count: 0, availableLines: [] } });
    expect(descendants).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'enterprise:one');
    const read = query.mock.calls.find(([sql]) => String(sql).includes('from ordering.aftersale'));
    expect(read?.[0]).toContain('orders.scope_id=any($5::text[])');
    expect(read?.[0]).toContain("$7='unpaid'");
    expect(read?.[0]).toContain('orders.mall_id=$15');
    expect(read?.[1]).toEqual([false, 'enterprise:one', false, false, ['enterprise:one', 'mall:one'], '', 'all', '', 'UTC', null, null, '', '', '', '', '', '', [], null, null, '', null, null, 51]);
  });

  it('keeps storefront member lists within the current member id without organization traversal', async () => {
    const descendants = vi.fn();
    const query = vi.fn(async (_sql: string, _values: readonly unknown[]) => ({ rows: [], rowCount: 0 }));
    const service = new AfterSalePersistence({ evaluate: vi.fn() } as never, { descendants } as never, { search: vi.fn() });

    await service.read(request('storefront', 'owner', 'member:one'), { query, transaction: {} } as never);

    expect(descendants).not.toHaveBeenCalled();
    expect(query.mock.calls[0]?.[1]).toEqual([true, 'member:one', false, false, [], '', 'all', '', 'UTC', null, null, '', '', '', '', '', '', [], null, null, '', null, null, 51]);
  });

  it('uses the configured organization timezone and every bounded filter', async () => {
    const descendants = vi.fn(async () => Object.freeze(['enterprise:one', 'mall:one']));
    const scope = vi.fn(async () => ({ timezone: 'Asia/Shanghai' }));
    const query = vi.fn(async (_sql: string, _values: readonly unknown[]) => ({ rows: [], rowCount: 0 }));
    const service = new AfterSalePersistence({ evaluate: vi.fn() } as never, { descendants, scope } as never, { search: vi.fn() });
    const filtered = request('console', 'enterprise', 'enterprise:one');
    filtered.input.query = {
      limit: '50',
      search: 'ZD202609050001',
      placed: 'today',
      lifecycle: 'paid',
      payment: 'paid',
      fulfillment: 'allocated',
      mall: 'mall:one',
    };

    await service.read(filtered, { query, transaction: {} } as never);

    expect(scope).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'enterprise:one');
    expect(query.mock.calls[0]?.[1]).toEqual([false, 'enterprise:one', false, false, ['enterprise:one', 'mall:one'], 'ZD202609050001', 'all', 'today', 'Asia/Shanghai', null, null, 'paid', 'paid', 'allocated', 'mall:one', '', '', [], null, null, '', null, null, 51]);
  });
});

function request(target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier', kind: 'enterprise' | 'owner', scope: string): MutableRequest {
  return {
    type: 'order.aftersales.read',
    input: { path: {}, query: { limit: '50' }, headers: {}, body: null, rawBody: '', deadline: Date.now() + 1000, signal: new AbortController().signal },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target, assurance: { level: 1 } },
        membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(['order.aftersale.read']), denies: new Set() }, scopes: [] },
        roles: [],
        organization: target === 'storefront' ? 'mall:one' : 'enterprise:one',
        scope: { id: scope, kind, path: [] },
        accessVersion: 1,
        capabilities: new Set(['order.aftersales.read']),
        capabilityVersion: 1,
        assurance: { level: 1 },
        trace: 'trace:one',
      },
    },
  };
}

type MutableRequest = Omit<OperationRequest, 'input'> & { input: Omit<OperationRequest['input'], 'query'> & { query: Record<string, string | readonly string[]> } };
