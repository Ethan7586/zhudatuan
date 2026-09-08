import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { pgTransactionState } from '../../../../platform/database/PgTransactionState';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { PgCommissionSettlementProcess } from './PgCommissionSettlementProcess';

describe('Referral settlement persistence', () => {
  it('uses skip-locked concurrency and one stable Finance business key', async () => {
    let claimed = false;
    const statements: string[] = [];
    const query = vi.fn(async (sql: string) => {
      statements.push(sql);
      if (sql.includes('select id,business_key')) {
        if (claimed) return result([]);
        claimed = true;
        return result([commission()]);
      }
      if (sql.includes('update referral.commission set state')) return result([{ version: 2 }]);
      if (sql.includes('from referral.withdrawalclaim') && sql.includes('for update skip locked')) return result([]);
      if (sql.includes('select exists(select 1 from referral.commission')) return result([{ pending: false }]);
      return result([]);
    });
    let sequence = 0;
    const manager = {
      write: async (options: Readonly<Record<string, unknown>>, work: (context: WriteTransactionContext) => Promise<unknown>) => {
        sequence += 1;
        const context = { id: `transaction:${sequence}`, mode: 'write', ...options } as unknown as WriteTransactionContext;
        return pgTransactionState.run({ client: { query } as unknown as PoolClient, context, mode: 'write', open: true }, () => work(context));
      },
    };
    const post = vi.fn(async () => ({ journalId: 'journal:one' }));
    const process = new PgCommissionSettlementProcess(manager as never, { post } as never, { now: () => new Date('2026-09-05T08:00:00.000Z') });
    const [first, second] = await Promise.all([process.settle('mall:one', 'order:one', new AbortController().signal, Date.now() + 10_000), process.settle('mall:one', 'order:one', new AbortController().signal, Date.now() + 10_000)]);

    expect([...first.items, ...second.items].filter(({ outcome }) => outcome === 'succeeded')).toHaveLength(1);
    expect(post).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ businessKey: 'settle:mall:one:referralcommission:one', amountMinor: 450n }));
    expect(statements.some((sql) => sql.includes('for update skip locked limit'))).toBe(true);
  });
});

function commission() {
  return {
    id: 'referralcommission:one',
    business_key: 'commission:one',
    beneficiary_id: 'member:direct',
    kind: 'commission',
    order_id: 'order:one',
    order_line_id: 'orderline:one',
    rule_id: 'referralproduct:one',
    rule_version: 2,
    binding_id: 'referralbinding:one',
    base_minor: 10_000,
    refunded_base_minor: 1_000,
    rate_basis_points: 500,
    amount_minor: 500,
    reversed_minor: 50,
    currency: 'CNY',
    eligible_at: '2026-09-05T07:00:00.000Z',
    state: 'available',
    version: 1,
  };
}

function result<T>(rows: readonly T[], rowCount = rows.length): QueryResult<T & Record<string, unknown>> {
  return { rows: rows as (T & Record<string, unknown>)[], rowCount, command: '', oid: 0, fields: [] };
}
