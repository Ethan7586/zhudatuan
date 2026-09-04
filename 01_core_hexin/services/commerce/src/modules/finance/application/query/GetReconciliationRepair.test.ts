import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationAction, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { getReconciliationRepairOperations } from './GetReconciliationRepair';

describe('reconciliation repair authoritative receipt read', () => {
  it('reads only the requested repair inside the authenticated Scope', async () => {
    const receipt = { repair: { id: 'repair:one', version: 3 }, lines: [], effects: [], item: { id: 'item:one' } };
    const query = vi.fn(async () => result([{ receipt }]));
    const response = await action()(request('repair:one'), { query } as unknown as OperationDatabase);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('finance.read_reconciliation_repair'), ['repair:one', 'mall:one']);
    expect(response).toEqual({ status: 200, body: receipt, headers: { etag: '"3"' } });
  });

  it('fails closed for a missing or cross-Scope receipt', async () => {
    const query = vi.fn(async () => result([{ receipt: null }]));
    await expect(action()(request('repair:missing'), { query } as unknown as OperationDatabase)).rejects.toThrow('CONTRACT_RESPONSE_INVALID:finance.reconciliationrepair');
  });
});

function action(): OperationAction {
  const candidate = (getReconciliationRepairOperations() as Readonly<Record<string, unknown>>)['finance.reconciliationrepairs.read'];
  if (typeof candidate !== 'function') throw new Error('TEST_OPERATION_MISSING:finance.reconciliationrepairs.read');
  return candidate as OperationAction;
}

function request(repair: string): OperationRequest {
  return {
    type: 'finance.reconciliationrepairs.read',
    access: {
      actor: { id: 'member:one' },
      scope: { id: 'mall:one', kind: 'mall' },
      trace: 'trace:repair-read',
    },
    input: { path: { repairid: repair }, query: {}, headers: {}, body: null },
  } as unknown as OperationRequest;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length } as unknown as QueryResult<Record<string, unknown>>;
}
