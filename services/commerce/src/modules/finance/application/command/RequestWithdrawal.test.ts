import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationAction, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requestWithdrawalOperations } from './RequestWithdrawal';

describe('withdrawal recovery', () => {
  it('moves an uncertain referral payout directly to processing for idempotent resolution', async () => {
    const query = vi.fn(async (_sql: string, _parameters?: readonly unknown[]) => result([{ id: 'withdrawal:one', state: 'processing', version: 4 }]));
    const enqueue = vi.fn(async () => undefined);
    const actions = requestWithdrawalOperations(() => ({ enqueue, event: vi.fn(async () => undefined) }));
    const action = actions['finance.withdrawals.recover'] as OperationAction;

    const response = await action(request(), { query } as unknown as OperationDatabase);

    expect(String(query.mock.calls[0]?.[0])).toContain("case when source_kind='referral' and state='uncertain' then 'processing' else 'approved' end");
    expect(query.mock.calls[0]?.[1]).toEqual(['withdrawal:one', 'mall:one', expect.stringContaining('"recoveredBy":"finance:reviewer"'), 3]);
    expect(enqueue).toHaveBeenCalledWith('settlement', 'mall:one', { withdrawal: 'withdrawal:one' }, 'job:withdrawal:withdrawal:one', true);
    expect(response).toMatchObject({ status: 202, body: { state: 'processing', version: 4 } });
  });
});

function request(): OperationRequest {
  return {
    type: 'finance.withdrawals.recover',
    access: {
      actor: { id: 'finance:reviewer' },
      scope: { id: 'mall:one', kind: 'mall' },
      trace: 'trace:withdrawal-recovery',
    },
    input: {
      path: { withdrawalid: 'withdrawal:one' },
      query: {},
      headers: {},
      body: { reason: 'resolve uncertain provider result', evidence: { ticket: 'FIN-1' } },
      rawBody: '{}',
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
      expectedVersion: 3,
      idempotency: 'recover:withdrawal:one',
    },
  } as unknown as OperationRequest;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length } as unknown as QueryResult<Record<string, unknown>>;
}
