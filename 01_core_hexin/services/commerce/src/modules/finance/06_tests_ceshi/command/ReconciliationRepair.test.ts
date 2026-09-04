import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { operationRequestHash, type OperationAction, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { reconciliationRepairOperations } from '../../03_application_yingyong/command/ReconciliationRepair';

describe('reconciliation repair commands', () => {
  it('previews only INTERNAL_JOURNAL_MISSING from server-authoritative inputs', async () => {
    const query = vi.fn(async () => result([{ receipt: receipt(0) }]));
    const action = command('finance.reconciliationrepairs.preview');
    const response = await action(
      request('finance.reconciliationrepairs.preview', { reconciliationid: 'reconciliation:one', itemid: 'item:one' }, { reason: 'INTERNAL_JOURNAL_MISSING', evidence: { ticket: 'FIN-1' }, itemVersion: 7 }, 11, 'preview:one'),
      { query } as unknown as OperationDatabase
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('finance.preview_reconciliation_repair'), ['reconciliation:one', 'item:one', 'mall:one', 'member:one', 'preview:one', 11, 7, 'INTERNAL_JOURNAL_MISSING', '{"ticket":"FIN-1"}']);
    expect(response).toEqual({ status: 201, body: receipt(0), headers: { etag: '"0"' } });
  });

  it('fails closed before SQL for unsupported reasons and any client-supplied accounting plan', async () => {
    const query = vi.fn();
    const action = command('finance.reconciliationrepairs.preview');
    await expect(
      action(request('finance.reconciliationrepairs.preview', { reconciliationid: 'reconciliation:one', itemid: 'item:one' }, { reason: 'AMOUNT_MISMATCH', evidence: {}, itemVersion: 0 }, 0, 'preview:reason'), {
        query,
      } as unknown as OperationDatabase)
    ).rejects.toThrow('FINANCE_REPAIR_REASON_UNSUPPORTED');
    await expect(
      action(
        request(
          'finance.reconciliationrepairs.preview',
          { reconciliationid: 'reconciliation:one', itemid: 'item:one' },
          { reason: 'INTERNAL_JOURNAL_MISSING', evidence: {}, itemVersion: 0, amountMinor: 1, debitAccount: 'cash' },
          0,
          'preview:plan'
        ),
        { query } as unknown as OperationDatabase
      )
    ).rejects.toThrow('VALIDATION_FAILED:unexpected:amountMinor');
    expect(query).not.toHaveBeenCalled();
  });

  it('submits an exact preview hash with the request idempotency and expected repair version', async () => {
    const hash = 'a'.repeat(64);
    const query = vi.fn(async () => result([{ receipt: receipt(1) }]));
    const operation = request('finance.reconciliationrepairs.submit', { repairid: 'repair:one' }, { previewHash: hash }, 0, 'submit:one');
    const response = await command('finance.reconciliationrepairs.submit')(operation, { query } as unknown as OperationDatabase);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('finance.submit_reconciliation_repair'), ['repair:one', 'mall:one', 'member:one', 'submit:one', 0, hash, operationRequestHash(operation)]);
    expect(response.headers).toEqual({ etag: '"1"' });
  });

  it('passes a constrained second-reviewer decision and evidence to the controlled function', async () => {
    const query = vi.fn(async () => result([{ receipt: receipt(2) }]));
    const operation = request('finance.reconciliationrepairs.decide', { repairid: 'repair:one' }, { decision: 'approve', reason: 'facts independently verified', evidence: { ticket: 'FIN-2' } }, 1, 'decide:one');
    await command('finance.reconciliationrepairs.decide')(
      operation,
      { query } as unknown as OperationDatabase
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('finance.decide_reconciliation_repair'), ['repair:one', 'mall:one', 'member:one', 'decide:one', 1, 'approve', 'facts independently verified', '{"ticket":"FIN-2"}', operationRequestHash(operation)]);
  });

  it('rejects non-authoritative decision vocabulary before SQL', async () => {
    const query = vi.fn();
    await expect(
      command('finance.reconciliationrepairs.decide')(request('finance.reconciliationrepairs.decide', { repairid: 'repair:one' }, { decision: 'approved', reason: 'wrong vocabulary', evidence: {} }, 1, 'decide:invalid'), {
        query,
      } as unknown as OperationDatabase)
    ).rejects.toThrow('FINANCE_REPAIR_DECISION_INVALID');
    expect(query).not.toHaveBeenCalled();
  });

  it('reverses by repair identity without accepting client journal or entry data', async () => {
    const query = vi.fn(async () => result([{ receipt: receipt(3) }]));
    const operation = request('finance.reconciliationrepairs.reverse', { repairid: 'repair:one' }, { reason: 'authoritative source was withdrawn' }, 2, 'reverse:one');
    await command('finance.reconciliationrepairs.reverse')(operation, {
      query,
    } as unknown as OperationDatabase);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('finance.reverse_reconciliation_repair'), ['repair:one', 'mall:one', 'member:one', 'reverse:one', 2, 'authoritative source was withdrawn', operationRequestHash(operation)]);

    const forbiddenQuery = vi.fn();
    await expect(
      command('finance.reconciliationrepairs.reverse')(request('finance.reconciliationrepairs.reverse', { repairid: 'repair:one' }, { reason: 'attempted override', journal: 'journal:client' }, 2, 'reverse:forbidden'), {
        query: forbiddenQuery,
      } as unknown as OperationDatabase)
    ).rejects.toThrow('VALIDATION_FAILED:unexpected:journal');
    expect(forbiddenQuery).not.toHaveBeenCalled();
  });

  it('fails closed when a controlled function does not return a versioned authoritative receipt', async () => {
    const action = command('finance.reconciliationrepairs.submit');
    const base = request('finance.reconciliationrepairs.submit', { repairid: 'repair:one' }, { previewHash: 'a'.repeat(64) }, 0, 'submit:invalid-receipt');
    await expect(action(base, database([null]))).rejects.toThrow('CONTRACT_RESPONSE_INVALID:finance.reconciliationrepair');
    await expect(action(base, database([{ repair: { id: 'repair:one' } }]))).rejects.toThrow('CONTRACT_RESPONSE_INVALID:finance.reconciliationrepair.version');
  });
});

function command(operation: string): OperationAction {
  const actions = reconciliationRepairOperations() as Readonly<Record<string, unknown>>;
  const action = actions[operation];
  if (typeof action !== 'function') throw new Error(`TEST_OPERATION_MISSING:${operation}`);
  return action as OperationAction;
}

function request(operation: string, path: Readonly<Record<string, string>>, body: Readonly<Record<string, unknown>>, expectedVersion: number, idempotency: string): OperationRequest {
  return {
    type: operation,
    access: {
      actor: { id: 'member:one' },
      scope: { id: 'mall:one', kind: 'mall' },
      trace: 'trace:repair',
    },
    input: {
      path,
      query: {},
      headers: {},
      body,
      rawBody: JSON.stringify(body),
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
      expectedVersion,
      idempotency,
    },
  } as unknown as OperationRequest;
}

function receipt(version: number) {
  return { repair: { id: 'repair:one', version }, lines: [], effects: [] };
}

function database(receipts: readonly unknown[]): OperationDatabase {
  return { query: vi.fn(async () => result(receipts.map((value) => ({ receipt: value })))) } as unknown as OperationDatabase;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length } as unknown as QueryResult<Record<string, unknown>>;
}
