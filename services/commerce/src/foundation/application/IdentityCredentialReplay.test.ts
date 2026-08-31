import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { AuditSink } from './AuditSink';
import { ModuleOperations, type OperationAction } from './ModuleOperations';
import type { OperationId } from '@shop/contract';
import type { OperationRequest, OperationResult } from './OperationHandler';
import type { DatabasePool } from '../persistence/Pool';

describe('identity credential idempotency', () => {
  it.each(['identity.sessions.create', 'identity.sessions.complete', 'identity.tickets.exchange', 'identity.invitations.create', 'identity.enrollments.complete', 'identity.federations.start'] as const)(
    'persists a secret-free one-time replay for %s',
    async (operation) => {
      const secret = `secret-for-${operation}`;
      const result: OperationResult = {
        status: operation === 'identity.tickets.exchange' ? 200 : 201,
        body: {
          session: `session-${secret}`,
          csrf: `csrf-${secret}`,
          ticket: `ticket-${secret}`,
        },
        headers: { 'x-set-cookie': `__Host-storefront-session=${secret}; Secure; HttpOnly; SameSite=Strict` },
      };
      const harness = identityOperationHarness(operation, result);
      const request = identityRequest(operation);

      await expect(harness.operations.invoke(request)).resolves.toEqual(result);
      expect(harness.persisted()).toEqual({
        status: 409,
        body: {
          code: 'IDEMPOTENCY_REPLAY_FORBIDDEN',
        },
      });
      expect(JSON.stringify(harness.persisted())).not.toContain(secret);

      await expect(harness.operations.invoke(request)).resolves.toEqual(harness.persisted());
      expect(harness.executions()).toBe(1);
    }
  );
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
        requestHash = String(values[4]);
      }
      if (text.startsWith('select request_hash,state,response')) {
        return {
          rows: [{ request_hash: requestHash, state: replay === null ? 'started' : 'completed', response: replay }],
          rowCount: 1,
        } as unknown as QueryResult;
      }
      if (text.includes("update runtime.idempotency set state='completed'")) {
        replay = JSON.parse(String(values[4])) as OperationResult;
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

function identityRequest(type: 'identity.sessions.create' | 'identity.sessions.complete' | 'identity.tickets.exchange' | 'identity.invitations.create' | 'identity.enrollments.complete' | 'identity.federations.start'): OperationRequest {
  return {
    type,
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'test:anonymous' },
    input: {
      path: {},
      query: {},
      headers: {},
      publicActor: `public:${'b'.repeat(64)}`,
      body: { subject: 'ethan', authorization: { state: 'state', nonce: 'nonce', challenge: 'challenge' } },
      rawBody: '',
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
      idempotency: `idempotency:${type}`,
    },
  };
}
