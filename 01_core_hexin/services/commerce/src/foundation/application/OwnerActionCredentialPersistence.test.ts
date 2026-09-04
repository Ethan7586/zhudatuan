import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { AuditSink } from './AuditSink';
import { ModuleOperations } from './ModuleOperations';
import type { OperationRequest } from './OperationHandler';
import type { DatabasePool } from '../persistence/Pool';

describe('Owner action credential persistence', () => {
  it('returns a proof once without persisting it in audit or idempotency replay', async () => {
    const secret = 'owner-action-proof:private';
    let stored: Readonly<{ request_hash: string; state: string; response: unknown }> | undefined;
    let auditFact: unknown;
    let executions = 0;
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        if (text.includes('insert into runtime.idempotency') && stored === undefined) {
          stored = { request_hash: String(values[3]), state: 'started', response: null };
        } else if (text.startsWith('select request_hash,state,response')) {
          return result(stored === undefined ? [] : [stored]);
        } else if (text.includes("update runtime.idempotency set state='completed'")) {
          stored = { request_hash: stored!.request_hash, state: 'completed', response: JSON.parse(String(values[3])) };
        }
        return result([]);
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const pool: DatabasePool = {
      connect: async () => client,
      query: async () => result([]),
      workload: () => pool,
      end: async () => undefined,
    };
    const audit: AuditSink = {
      record: async (_database, input) => { auditFact = input; },
      access: async () => undefined,
    };
    const operations = new ModuleOperations('access', pool, audit, {
      'access.ownership.transfers.preview': async () => {
        executions += 1;
        return { status: 200, body: { proof: secret, expiresAt: '2026-08-29T12:05:00.000Z' } };
      },
    }, ['access.ownership.transfers.preview']);
    const request: OperationRequest = {
      type: 'access.ownership.transfers.preview',
      access: {
        actor: { id: 'principal:owner', session: 'session:owner', membership: 'membership:owner',
          credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 3 } },
        membership: { id: 'membership:owner', active: true, accessVersion: 1, denies: [], grants: [] },
        scope: { kind: 'platform', id: 'organization-platform-root', tenant: 'tenant-zhudatuan', path: [] },
        accessVersion: 1, capabilities: ['access.ownership.transfers.preview'], assurance: { level: 3 },
        trace: 'trace:owner-proof',
      },
      input: {
        path: {}, query: {}, headers: {}, body: { targetMembership: 'membership:successor' }, rawBody: '',
        expectedVersion: 1, deadline: Date.now() + 5_000, signal: new AbortController().signal,
        idempotency: 'owner-proof-once',
      },
    };

    await expect(operations.invoke(request)).resolves.toMatchObject({ status: 200, body: { proof: secret } });
    await expect(operations.invoke(request)).resolves.toEqual({
      status: 409,
      body: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'IDENTITY_CREDENTIAL_RESPONSE_ONE_TIME' },
    });

    expect(executions).toBe(1);
    expect(JSON.stringify(auditFact)).not.toContain(secret);
    expect(JSON.stringify(stored?.response)).not.toContain(secret);
    expect(auditFact).toMatchObject({ after: { proof: '[REDACTED]', expiresAt: '2026-08-29T12:05:00.000Z' } });
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
