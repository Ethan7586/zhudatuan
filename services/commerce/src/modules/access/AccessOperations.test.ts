import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { IDENTITY_SECURITY_KEYS } from '../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../foundation/persistence/Pool';
import type { AccessContext } from '../../foundation/security/AccessContext';
import { accessOperations } from './AccessOperations';

describe('access scope management boundary', () => {
  it('fails closed when a runtime request attempts to create an unsupported deny scope', async () => {
    const harness = operationHarness();

    await expect(accessOperations(context(harness.pool)).invoke(scopeRequest('deny')))
      .rejects.toThrow('SCOPE_DENY_UNSUPPORTED');
    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
  });
});

function scopeRequest(effect: string): OperationRequest {
  return {
    type: 'access.scopes.manage',
    access: managerAccess(),
    input: {
      path: { membershipid: 'membership:target' }, query: {}, headers: {},
      body: { kind: 'mall', scope: 'mall-zhudatuan', effect }, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal,
      idempotency: 'scope-management:deny',
    },
  };
}

function managerAccess(): AccessContext {
  const scope = { kind: 'mall' as const, id: 'mall-zhudatuan', tenant: 'tenant-zhudatuan', path: [] };
  return {
    actor: { id: 'principal:manager', session: 'session:manager', membership: 'membership:manager', credentialVersion: 1,
      accessVersion: 2, target: 'console', assurance: { level: 2 } },
    membership: { id: 'membership:manager', active: true, accessVersion: 2, denies: [], grants: [{
      scope, permissions: ['access.scope.manage'], effective: '2026-08-29T00:00:00.000Z', expires: null,
    }] },
    scope, accessVersion: 2, capabilities: ['access.scopes.manage'], assurance: { level: 2 }, trace: 'trace:scope-deny',
  };
}

function operationHarness(): Readonly<{ pool: DatabasePool; queries: readonly string[] }> {
  let requestHash = '';
  const queries: string[] = [];
  const client = {
    query: async (text: string, values: readonly unknown[] = []) => {
      queries.push(text);
      if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
      if (text.startsWith('select request_hash,state,response')) {
        return result([{ request_hash: requestHash, state: 'started', response: null }]);
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
  return { pool, queries };
}

function context(pool: DatabasePool): ModuleContext {
  const container = new Container();
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
  container.bind(IDENTITY_SECURITY_KEYS, { identity: 'identity-key', session: 'session-key' });
  return { container } as unknown as ModuleContext;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
