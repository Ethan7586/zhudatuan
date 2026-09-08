import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { PgRuleRepository } from './PgRuleRepository';

const context = {} as WriteTransactionContext;

describe('PgRuleRepository', () => {
  it('persists a complete draft interval at version one', async () => {
    const query = vi.fn(async (_sql: string, values?: readonly unknown[]) => ({
      rows: [
        {
          id: values?.[0],
          scope_id: values?.[1],
          priority: values?.[2],
          kind: values?.[3],
          condition: {},
          effect: { fixedMinor: 100 },
          version: 1,
          status: 'draft',
          effective_at: new Date('2026-09-06T00:00:00.000Z'),
          expires_at: new Date('2026-10-01T00:00:00.000Z'),
          approved_by: null,
        },
      ],
      rowCount: 1,
    }));
    const repository = new PgRuleRepository(access(query));
    const rule = await repository.create(context, {
      id: 'rule:one',
      scope: 'mall:one',
      priority: 10,
      kind: 'markup',
      condition: {},
      effect: { fixedMinor: 100 },
      effectiveAt: '2026-09-06T00:00:00.000Z',
      expiresAt: '2026-10-01T00:00:00.000Z',
    });
    expect(rule).toMatchObject({ version: 1, status: 'draft', effective_at: '2026-09-06T00:00:00.000Z', approved_by: null });
  });

  it('locks then publishes with an exact version and records the independent checker', async () => {
    const draft = {
      id: 'rule:one',
      scope_id: 'mall:one',
      priority: 10,
      kind: 'discount',
      condition: {},
      effect: { fixedMinor: 100 },
      version: 1,
      status: 'draft',
      effective_at: new Date('2026-09-01T00:00:00.000Z'),
      expires_at: new Date('2099-10-01T00:00:00.000Z'),
      approved_by: null,
    };
    const query = vi.fn(async (sql: string) => ({ rows: [sql.startsWith('select') ? draft : { ...draft, version: 2, status: 'published', approved_by: 'principal:checker' }], rowCount: 1 }));
    const repository = new PgRuleRepository(access(query));
    const rule = await repository.publish(context, 'rule:one', 1, 'principal:checker');
    expect(String(query.mock.calls[0]?.[0])).toContain('for update');
    expect(String(query.mock.calls[1]?.[0])).toContain('version=$5');
    expect(rule).toMatchObject({ status: 'published', version: 2, approved_by: 'principal:checker' });
  });
});

function access(query: ReturnType<typeof vi.fn>): PgTransactionAccess {
  return { database: () => ({ query }) as unknown as SqlExecutor } as unknown as PgTransactionAccess;
}
