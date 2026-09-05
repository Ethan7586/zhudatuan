import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import {
  operationRequestHash,
  type OperationAction,
  type OperationDatabase,
} from '../../../../foundation/application/ModuleOperations';
import { financePolicyWorkflowOperations } from '../../03_application_yingyong/command/FinancePolicyWorkflow';

describe('finance policy workflow', () => {
  it('previews a policy through the controlled database workflow', async () => {
    const query = vi.fn(async () => result([{ receipt: { preview: { sourceVersion: '0' } } }]));
    const response = await action('finance.policies.preview')(
      request('finance.policies.preview', {
        action: 'saveDraft',
        kind: 'invoice',
        rule: {},
        desiredState: 'active',
      }, 'preview:one'),
      { query } as unknown as OperationDatabase,
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('finance.preview_configurable_policy'), [
      'policy:one', 'platform:one', 'member:one', 'preview:one', 0,
      'saveDraft', 'invoice', '{}', 'active', '1970-01-01', null,
    ]);
    expect(response).toEqual({ status: 201, body: { preview: { sourceVersion: '0' } }, headers: { etag: '"0"' } });
  });

  it('manages only the exact preview hash through the controlled database workflow', async () => {
    const hash = 'a'.repeat(64);
    const operation = request('finance.policies.manage', {
      action: 'submit',
      previewHash: hash,
      reason: 'reviewed finance policy',
      evidence: { ticket: 'FIN-3' },
    }, 'manage:one');
    const query = vi.fn(async () => result([{ receipt: { policy: { version: 1 } } }]));
    const response = await action('finance.policies.manage')(operation, { query } as unknown as OperationDatabase);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('finance.manage_configurable_policy'), [
      'policy:one', 'platform:one', 'member:one', 'manage:one', 0,
      'submit', hash, 'reviewed finance policy', '{"ticket":"FIN-3"}', operationRequestHash(operation),
    ]);
    expect(response).toEqual({ status: 200, body: { policy: { version: 1 } }, headers: { etag: '"1"' } });
  });
});

function action(operation: string): OperationAction {
  const candidate = (financePolicyWorkflowOperations() as Readonly<Record<string, unknown>>)[operation];
  if (typeof candidate !== 'function') throw new Error(`TEST_OPERATION_MISSING:${operation}`);
  return candidate as OperationAction;
}

function request(operation: string, body: Readonly<Record<string, unknown>>, idempotency: string): OperationRequest {
  return {
    type: operation,
    access: {
      actor: { id: 'member:one' },
      scope: { id: 'platform:one', kind: 'platform' },
      trace: 'trace:policy',
    },
    input: {
      path: { policyid: 'policy:one' },
      query: {},
      headers: {},
      body,
      rawBody: JSON.stringify(body),
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
      expectedVersion: 0,
      idempotency,
    },
  } as unknown as OperationRequest;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length } as unknown as QueryResult<Record<string, unknown>>;
}
