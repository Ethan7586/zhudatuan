import { describe, expect, it, vi } from 'vitest';
import { result, transactionManager } from '../../../test/TransactionFixture';
import type { FinanceChannelPort } from '../../channel/public';
import type { FinanceFulfillmentPort } from '../../fulfillment/public';
import type { FinancePaymentPort } from '../../payment/public';
import type { TabularFilePort } from '../../runtime/public';
import { ReconcileStatement } from '../infrastructure/persistence/ReconciliationActions';

describe('finance reconciliation source', () => {
  it('consumes already-published immutable StatementLine rows without reading or parsing the object again', async () => {
    const statements: string[] = [];
    const query = vi.fn(async (sql: string) => {
      statements.push(sql.replace(/\s+/g, ' ').trim());
      if (sql.includes('line_count'))
        return result([
          {
            scope_id: 'mall:one',
            provider: 'provider',
            partner_id: 'partner:one',
            period: '2026-09',
            created_by: 'maker',
            statement_hash: 'a'.repeat(64),
            statement_ref: 'object:statement',
            statement_id: 'statement:one',
            reconciliation_debit: 0,
            reconciliation_credit: 0,
            reconciliation_difference: 0,
            version: 0,
            local_hash: 'a'.repeat(64),
            local_debit: 500,
            local_credit: 200,
            threshold_rule: { amountMinor: 0 },
            line_count: 2,
          },
        ]);
      if (sql.includes("set state='matching'")) return result([{ id: 'reconciliation:one' }]);
      if (sql.includes('array_agg(external_reference')) return result([{ count: 2, payments: 500, refunds: 200, references: ['pay:one', 'refund:one'] }]);
      if (sql.includes('count(*) filter')) return result([{ net: 300, differences: 0, maximum: 0 }]);
      if (sql.includes('set debit_minor=')) return result([{ id: 'reconciliation:one' }]);
      return result([]);
    });
    const batches = vi.fn<TabularFilePort['batches']>();
    const statement = vi.fn<FinanceChannelPort['statement']>();
    const payments = vi.fn<FinancePaymentPort['reconciliation']>(async () => []);
    const fulfillments = vi.fn<FinanceFulfillmentPort['reconciliation']>(async () => []);
    const process = new ReconcileStatement(transactionManager(query), { batches }, { statement } as unknown as FinanceChannelPort, { reconciliation: payments } as unknown as FinancePaymentPort, { reconciliation: fulfillments });

    await process.execute('reconciliation:one', 'mall:one', new AbortController().signal, Date.now() + 10_000);

    expect(batches).not.toHaveBeenCalled();
    expect(statement).not.toHaveBeenCalled();
    expect(payments).toHaveBeenCalledWith(expect.anything(), ['pay:one', 'refund:one']);
    expect(statements.some((sql) => sql.includes('insert into finance.statementline'))).toBe(false);
    expect(statements.some((sql) => sql.includes('array_agg(external_reference'))).toBe(true);
  });

  it('streams a Channel statement through the Runtime tabular port in bounded batches', async () => {
    const statements: string[] = [];
    const query = vi.fn(async (sql: string) => {
      statements.push(sql.replace(/\s+/g, ' ').trim());
      if (sql.includes('line_count'))
        return result([
          {
            scope_id: 'mall:one',
            provider: 'provider',
            partner_id: 'partner:one',
            period: '2026-09',
            created_by: 'maker',
            statement_hash: 'a'.repeat(64),
            statement_ref: 'channel:statement',
            statement_id: null,
            reconciliation_debit: 0,
            reconciliation_credit: 0,
            reconciliation_difference: 0,
            version: 0,
            local_hash: null,
            local_debit: null,
            local_credit: null,
            threshold_rule: { amountMinor: 0 },
            line_count: 0,
          },
        ]);
      if (sql.includes("set state='matching'")) return result([{ id: 'reconciliation:one' }]);
      if (sql.includes('insert into finance.statementline')) return result([{ id: 'statementline:one' }, { id: 'statementline:two' }]);
      if (sql.includes('array_agg(external_reference')) return result([{ count: 2, payments: 500, refunds: 200, references: ['pay:one', 'refund:one'] }]);
      if (sql.includes('count(*) filter')) return result([{ net: 300, differences: 0, maximum: 0 }]);
      if (sql.includes('set debit_minor=')) return result([{ id: 'reconciliation:one' }]);
      return result([]);
    });
    const batches = vi.fn(async function* () {
      yield [
        { reference: 'pay:one', type: 'payment', amountMinor: '500', currency: 'CNY' },
        { reference: 'refund:one', type: 'refund', amountMinor: '200', currency: 'CNY' },
      ];
    });
    const process = new ReconcileStatement(
      transactionManager(query),
      { batches },
      {
        statement: vi.fn(async () => ({ id: 'channel:statement', scope: 'mall:one', objectRef: 'object:channel', sha256: 'a'.repeat(64), period: { start: '2026-08-01', end: '2026-08-31', timezone: 'Asia/Shanghai' } })),
      } as unknown as FinanceChannelPort,
      { reconciliation: vi.fn(async () => []) } as unknown as FinancePaymentPort,
      { reconciliation: vi.fn(async () => []) }
    );

    await process.execute('reconciliation:one', 'mall:one', new AbortController().signal, Date.now() + 10_000);

    expect(batches).toHaveBeenCalledWith('object:channel', 'a'.repeat(64));
    expect(statements.filter((sql) => sql.includes('insert into finance.statementline'))).toHaveLength(1);
  });
});
