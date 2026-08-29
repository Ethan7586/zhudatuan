import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { AccessContext } from '../../../../foundation/security/AccessContext';
import type { FinanceRepository } from '../port/FinanceRepository';
import { requestInvoiceOperations } from './RequestInvoice';

describe('invoice request organization boundary', () => {
  it('creates a request when profile, settlement and authorized scope share the organization', async () => {
    const queries: Array<{ text: string; values: readonly unknown[] }> = [];
    const database: OperationDatabase = {
      query: async (text, values = []) => {
        queries.push({ text, values });
        if (text.startsWith('select line.id')) return result([{
          id: 'line:one', source_type: 'order', source_id: 'order:one', amount_minor: 100, tax_minor: 6,
        }]);
        if (text.startsWith('insert into invoice.request(')) return result([{ id: 'invoice:created', state: 'submitted' }]);
        return result([]);
      },
    };
    const operation = requestInvoiceOperations(() => repository())['invoice.requests.create'];
    if (typeof operation !== 'function') throw new Error('TEST_OPERATION_MISSING');

    await expect(operation(request(), database)).resolves.toMatchObject({ status: 201 });

    expect(queries[0]?.text).toContain('settlement.scope_id=$2');
    expect(queries[0]?.values).toEqual(['settlement:one', 'mall:one', ['line:one']]);
    const insert = queries.find((query) => query.text.startsWith('insert into invoice.request('));
    expect(insert?.text).toContain('profile.owner_id=$9');
    expect(insert?.text).toContain('settlement.scope_id=$9');
    expect(insert?.values.at(-1)).toBe('mall:one');
  });

  it('fails closed when the settlement is outside the authorized organization', async () => {
    const database: OperationDatabase = { query: async () => result([]) };
    const operation = requestInvoiceOperations(() => repository())['invoice.requests.create'];
    if (typeof operation !== 'function') throw new Error('TEST_OPERATION_MISSING');

    await expect(operation(request(), database)).rejects.toThrow('INVOICE_LINES_NOT_ELIGIBLE_OR_AMOUNT_MISMATCH');
  });
});

function request(): OperationRequest {
  return {
    type: 'invoice.requests.create',
    access: operatorAccess(),
    input: {
      path: {}, query: {}, headers: {},
      body: { settlement: 'settlement:one', profile: 'profile:one', amountMinor: 100, lines: ['line:one'], reason: 'monthly' },
      rawBody: '{}', deadline: Date.now()+5_000, signal: new AbortController().signal, idempotency: 'invoice-request:one',
    },
  };
}

function operatorAccess(): AccessContext {
  const scope = { kind: 'mall' as const, id: 'mall:one', tenant: 'tenant:one', path: [] };
  return {
    actor: { id: 'principal:finance', session: 'session:finance', membership: 'membership:finance', credentialVersion: 1,
      accessVersion: 1, target: 'console', assurance: { level: 2 } },
    membership: { id: 'membership:finance', active: true, accessVersion: 1, denies: [], grants: [{
      scope, permissions: ['invoice.request.create'], effective: '2026-08-30T00:00:00.000Z', expires: null,
    }] },
    scope, accessVersion: 1, capabilities: ['invoice.requests.create'], assurance: { level: 2 }, trace: 'trace:invoice-request',
  };
}

function repository(): FinanceRepository {
  return { enqueue: async () => undefined, event: async () => undefined };
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
