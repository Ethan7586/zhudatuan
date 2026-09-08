import { OP_FINANCE_STATEMENTS_READ } from '@shop/contract/ids';
import { describe, expect, it, vi } from 'vitest';
import type { FinanceRequest } from '../infrastructure/persistence/FinanceOperation';
import type { FinanceScopeQuery } from '../infrastructure/persistence/FinanceScopeQuery';
import { statementQueries } from '../infrastructure/persistence/StatementQueries';

describe('finance statement read projection', () => {
  it('returns calendar dates without converting them into timezone instants', async () => {
    const descendants = vi.fn(async () => Object.freeze(['enterprise:one']));
    const queries: string[] = [];
    const database = {
      transaction: {},
      query: vi.fn(async (sql: string) => {
        queries.push(sql.replace(/\s+/gu, ' ').trim());
        return {
          rows: [
            {
              id: 'statement:one',
              period_start: '2026-08-01',
              period_end: '2026-08-31',
            },
          ],
        };
      }),
    };
    const action = statementQueries({ descendants } as unknown as FinanceScopeQuery).statementsRead;
    if (typeof action !== 'function') throw new Error('FINANCE_STATEMENT_READ_ACTION_REQUIRED');

    const result = await action(request(), database as never);

    expect(queries[0]).toContain('period_start::text period_start,period_end::text period_end');
    expect(result.body).toMatchObject({ items: [{ period_start: '2026-08-01', period_end: '2026-08-31' }] });
  });
});

function request(): FinanceRequest {
  return {
    type: OP_FINANCE_STATEMENTS_READ,
    input: {
      path: {},
      query: { limit: '20' },
      headers: {},
      body: null,
      rawBody: '',
      deadline: Date.now() + 10_000,
      signal: new AbortController().signal,
    },
    security: { kind: 'session', access: { scope: { id: 'enterprise:one', kind: 'enterprise', path: [] } } } as unknown as FinanceRequest['security'],
    transaction: {} as FinanceRequest['transaction'],
  };
}
