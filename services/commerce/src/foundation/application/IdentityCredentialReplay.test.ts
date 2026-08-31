import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { AuditSink } from './AuditSink';
import { ModuleOperations, type OperationAction } from './ModuleOperations';
import type { OperationId } from '@shop/contract';
import type { OperationRequest, OperationResult } from './OperationHandler';
import type { DatabasePool } from '../persistence/Pool';

describe('identity credential idempotency', () => {
  it.each(['identity.sessions.create', 'identity.tickets.exchange'] as const)('persists a secret-free one-time replay for %s', async (operation) => {
    const secret = `secret-for-${operation}`;
    const result: OperationResult = {
      status: operation === 'identity.sessions.create' ? 201 : 200,
      body: {
        session: `session-${secret}`,
        csrf: `csrf-${secret}`,
        ticket: `ticket-${secret}`,
      },
      headers: { 'x-set-cookie': `shop_session=${secret}; HttpOnly` },
    };
    const harness = identityOperationHarness(operation, result);
    const request = identityRequest(operation);

    await expect(harness.operations.invoke(request)).resolves.toEqual(result);
    expect(harness.persisted()).toEqual({
      status: 409,
      body: {
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'IDENTITY_CREDENTIAL_RESPONSE_ONE_TIME',
      },
    });
    expect(JSON.stringify(harness.persisted())).not.toContain(secret);

    await expect(harness.operations.invoke(request)).resolves.toEqual(harness.persisted());
    expect(harness.executions()).toBe(1);
  });

  it('persists a secret-free one-time replay for an administrator invitation', async () => {
    const secret = 'one-time-administrator-invitation';
    const result: OperationResult = {
      status: 201,
      body: { id: 'invitation:one', target: 'console', code: secret },
    };
    const harness = identityOperationHarness('identity.invitations.create', result);
    const request = identityRequest('identity.invitations.create');

    await expect(harness.operations.invoke(request)).resolves.toEqual(result);
    expect(harness.persisted()).toEqual({
      status: 409,
      body: {
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'IDENTITY_INVITATION_RESPONSE_ONE_TIME',
      },
    });
    expect(JSON.stringify(harness.persisted())).not.toContain(secret);

    await expect(harness.operations.invoke(request)).resolves.toEqual(harness.persisted());
    expect(harness.executions()).toBe(1);
  });
});

function identityOperationHarness(
  operation: OperationId,
  result: OperationResult
): Readonly<{
  operations: ModuleOperations;
  persisted: () => OperationResult | null;
  executions: () => number;
}> {
  let requestHash = '';
  let replay: OperationResult | null = null;
  let executions = 0;
  const client = {
    query: async (text: string, values: readonly unknown[] = []) => {
      if (text.includes('insert into runtime.idempotency') && requestHash.length === 0) {
        requestHash = String(values[3]);
      }
      if (text.startsWith('select request_hash,state,response')) {
        return {
          rows: [{ request_hash: requestHash, state: replay === null ? 'started' : 'completed', response: replay }],
          rowCount: 1,
        } as unknown as QueryResult;
      }
      if (text.includes("update runtime.idempotency set state='completed'")) {
        replay = JSON.parse(String(values[3])) as OperationResult;
      }
      return { rows: [], rowCount: 0 } as unknown as QueryResult;
    },
    release: () => undefined,
  } as unknown as PoolClient;
  const pool: DatabasePool = {
    connect: async () => client,
    query: async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult,
    workload: () => pool,
    end: async () => undefined,
  };
  const action: OperationAction = async () => {
    executions += 1;
    return result;
  };
  const audit: AuditSink = { record: async () => undefined, access: async () => undefined };
  const operations = new ModuleOperations('identity', pool, audit, { [operation]: action }, [operation]);
  return Object.freeze({ operations, persisted: () => replay, executions: () => executions });
}

function identityRequest(type: 'identity.sessions.create' | 'identity.tickets.exchange' | 'identity.invitations.create'): OperationRequest {
  return {
    type,
    access: null,
    input: {
      path: {},
      query: {},
      headers: {},
      body: { subject: 'ethan', authorization: { state: 'state', nonce: 'nonce', challenge: 'challenge' } },
      rawBody: '',
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
      idempotency: `idempotency:${type}`,
    },
  };
}
