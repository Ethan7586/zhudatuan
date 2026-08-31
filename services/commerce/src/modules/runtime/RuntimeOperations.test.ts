import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { CACHE, type Cache } from '../../foundation/cache/Cache';
import { DATABASE_POOL, type DatabasePool } from '../../foundation/persistence/Pool';
import { QUERY_METRICS, QueryMetrics } from '../../foundation/persistence/QueryMetrics';
import type { AccessContext } from '../../foundation/security/AccessContext';
import { runtimeOperations } from './RuntimeOperations';

describe('runtime dependency health', () => {
  it('applies FILTER to min(created_at), producing valid PostgreSQL aggregate syntax', async () => {
    const queries: string[] = [];
    const pool = database(queries);
    const container = new Container();
    container.bind(DATABASE_POOL, pool);
    container.bind(CACHE, cache());
    container.bind(QUERY_METRICS, new QueryMetrics());
    container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
    const context = { container, extensions: { healthAll: async () => [] } } as unknown as ModuleContext;

    await expect(runtimeOperations(context).invoke(request())).resolves.toMatchObject({ status: 503 });
    const query = queries.find((text) => text.includes('oldest_seconds from runtime.job'));
    expect(query).toContain("min(created_at) filter(where state='queued')");
    expect(query).not.toContain("min(created_at)) filter(where state='queued')");
  });
});

function database(queries: string[]): DatabasePool {
  const client = {
    query: async (text: string) => {
      queries.push(text);
      if (text.includes('not pg_is_in_recovery()')) return result([{ writable: true, schema: true, contract: true,
        operations: 0, capabilities: 0, events: 0 }]);
      return result([]);
    },
    release: () => undefined,
  } as unknown as PoolClient;
  const pool: DatabasePool = {
    connect: async () => client,
    query: async (text: string) => {
      queries.push(text);
      if (text.includes('oldest_seconds from runtime.job')) return result([{ queued: 0, running: 0, deadletters: 0, oldest_seconds: 0 }]);
      return result([]);
    },
    workload: () => pool,
    end: async () => undefined,
  };
  return pool;
}

function request(): OperationRequest {
  return {
    type: 'runtime.health.dependency', access: ownerAccess(),
    input: { path: {}, query: {}, headers: {}, body: null, rawBody: '', deadline: Date.now() + 5_000,
      signal: new AbortController().signal },
  };
}

function ownerAccess(): AccessContext {
  const scope = { kind: 'platform' as const, id: 'organization-platform-root', tenant: 'tenant-zhudatuan', path: [] };
  return {
    actor: { id: 'principal:owner', session: 'session:owner', membership: 'membership:owner', credentialVersion: 1,
      accessVersion: 1, target: 'console', assurance: { level: 2 } },
    membership: { id: 'membership:owner', active: true, accessVersion: 1, denies: [], grants: [] },
    scope, accessVersion: 1, capabilities: ['runtime.health.dependency'], assurance: { level: 2 }, trace: 'trace:health',
  };
}

function cache(): Cache {
  return { start: async () => undefined, onUnavailable: () => () => undefined, get: async () => null,
    put: async () => true, remove: async () => true, state: () => ({ available: true }), close: async () => undefined };
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
