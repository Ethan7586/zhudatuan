import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationAction, OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { getFinanceAuditOperations } from '../../03_application_yingyong/query/GetFinanceAudit';
import { getFinancePoliciesOperations } from '../../03_application_yingyong/query/GetFinancePolicies';
import { getInvoicesOperations } from '../../03_application_yingyong/query/GetInvoices';

describe('finance authority queries', () => {
  it.each([
    ['finance.policies.read', getFinancePoliciesOperations(), 'finance.policyrevision'],
    ['finance.audit.read', getFinanceAuditOperations(), 'audit.record'],
    ['invoice.operatorprofiles.read', getInvoicesOperations(), 'invoice.profile'],
  ] as const)('executes %s through its restored query', async (operation, actions, relation) => {
    const query = vi.fn(async () => result([]));
    const response = await action(actions, operation)(request(operation), { query } as unknown as OperationDatabase);

    expect(query).toHaveBeenCalledWith(expect.stringContaining(relation), expect.any(Array));
    expect(response.status).toBe(200);
  });
});

function action(actions: OperationActions, operation: string): OperationAction {
  const candidate = (actions as Readonly<Record<string, unknown>>)[operation];
  if (typeof candidate !== 'function') throw new Error(`TEST_OPERATION_MISSING:${operation}`);
  return candidate as OperationAction;
}

function request(operation: string): OperationRequest {
  return {
    type: operation,
    access: {
      actor: { id: 'member:one' },
      scope: { id: 'platform:one', kind: 'platform' },
      trace: 'trace:finance-authority',
    },
    input: {
      path: {},
      query: {},
      headers: {},
      body: undefined,
      rawBody: '',
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
    },
  } as unknown as OperationRequest;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length } as unknown as QueryResult<Record<string, unknown>>;
}
