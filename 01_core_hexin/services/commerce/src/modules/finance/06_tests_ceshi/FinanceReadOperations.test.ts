import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import type { OperationAction, OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { financeOperatorReadActions } from '../FinanceReadOperations';

describe('finance reconciliation directory', () => {
  it('returns the first page with one database read and no unused facet aggregation', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) =>
      ({ rows: [], rowCount: 0 } as unknown as QueryResult));
    const selected = financeOperatorReadActions()['finance.reconciliations.read'];
    if (typeof selected !== 'function') throw new Error('FINANCE_RECONCILIATIONS_READ_MISSING');

    const response = await (selected as OperationAction)(request(), { query } as unknown as OperationDatabase);

    expect(response).toEqual({ status: 200, body: { items: [], count: 0 } });
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0]?.[0])).toContain('from finance.reconciliation reconciliation');
    expect(String(query.mock.calls[0]?.[0])).not.toContain('differenceTypes');
  });
});

function request(): OperationRequest {
  return {
    type: 'finance.reconciliations.read',
    access: { scope: { id: 'mall:one', kind: 'mall' } },
    input: { path: {}, query: { limit: '50' }, headers: {}, body: null, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal },
  } as unknown as OperationRequest;
}
