import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import type { OperationRequest, OperationResult } from '../../foundation/application/OperationHandler';
import { CACHE, type Cache } from '../../foundation/cache/Cache';
import { VersionedKey } from '../../foundation/cache/VersionedKey';
import { DATABASE_POOL, type DatabasePool } from '../../foundation/persistence/Pool';
import { webReportingOperations } from './WebReportingOperations';

describe('web reporting dashboard read', () => {
  it('returns the projection-versioned cached dashboard without opening a transaction', async () => {
    const cached: OperationResult = { status: 200, body: { items: [], count: 0, summary: { cached: true } } };
    let connections = 0;
    const cacheReads: string[] = [];
    const pool = databasePool({
      connect: async () => { connections += 1; throw new Error('CACHE_HIT_MUST_NOT_CONNECT'); },
      query: async () => { throw new Error('WEB_REPORTING_MUST_NOT_READ_PROJECTION_OFFSET'); },
    });
    const cache = memoryCache(async <T>(key: string) => { cacheReads.push(key); return cached as T; });

    await expect(webReportingOperations(context(pool, cache)).invoke(request())).resolves.toEqual(cached);

    expect(connections).toBe(0);
    expect(cacheReads).toHaveLength(1);
    expect(cacheReads[0]).toBe(VersionedKey.create('reporting', {
      scope: 'mall:test', metric: 'dashboard', period: '30days', projectionversion: 0,
    }));
  });

  it('fills the cache from the shared period-aware reporting repository on a miss', async () => {
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const writes: Array<Readonly<{ key: string; value: unknown; seconds: number }>> = [];
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        queries.push({ text, values });
        if (text.includes('from reporting.fact') && text.includes('reporting.cockpit')) {
          return result([{ metrics: [], summary: { sales: { periodSalesCents: 12 } } }]);
        }
        return result([]);
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const pool = databasePool({
      connect: async () => client,
      query: async () => { throw new Error('WEB_REPORTING_MUST_NOT_READ_PROJECTION_OFFSET'); },
    });
    const cache = memoryCache(async () => null, async (key, value, seconds) => {
      writes.push({ key, value, seconds }); return true;
    });

    const response = await webReportingOperations(context(pool, cache)).invoke(request());

    expect(response).toMatchObject({ status: 200, body: { count: 0, summary: { sales: { periodSalesCents: 12 } } } });
    const dashboard = queries.filter(({ text }) => text.includes('reporting.cockpit'));
    expect(dashboard).toHaveLength(1);
    expect(dashboard[0]?.values).toEqual(['mall:test', null, null, '30days', null, null, 101, null]);
    expect(dashboard[0]?.text).toContain('CAST(fact.projection_version AS float8)');
    expect(writes).toHaveLength(1);
    expect(writes[0]?.value).toEqual(response);
    expect(writes[0]?.seconds).toBeGreaterThan(0);
  });

  it('normalizes database timestamp values when a dashboard cursor is present', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      code: `sales.metric.${index}`, cursorTime: new Date('2026-09-13T00:00:00.000Z'), cursorId: `metric:${index}`,
    }));
    const client = {
      query: async (text: string) => {
        if (text.includes('from reporting.fact') && text.includes('reporting.cockpit')) return result([{ metrics: rows, summary: {} }]);
        return result([]);
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const pool = databasePool({
      connect: async () => client,
      query: async () => { throw new Error('WEB_REPORTING_MUST_NOT_READ_PROJECTION_OFFSET'); },
    });

    const response = await webReportingOperations(context(pool, memoryCache(async () => null))).invoke(request());

    expect(response).toMatchObject({ status: 200, body: { count: 100, nextCursor: expect.any(String) } });
  });

  it('uses a process-local cache when the web runtime has no shared cache binding', async () => {
    let connections = 0;
    const client = {
      query: async (text: string) => {
        if (text.includes('reporting.cockpit')) return result([{ metrics: [], summary: { cachedLocally: true } }]);
        return result([]);
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const pool = databasePool({
      connect: async () => { connections += 1; return client; },
      query: async () => { throw new Error('WEB_REPORTING_MUST_NOT_READ_PROJECTION_OFFSET'); },
    });
    const operations = webReportingOperations(context(pool));

    await operations.invoke(request('mall:local-cache'));
    await expect(operations.invoke(request('mall:local-cache'))).resolves.toMatchObject({
      status: 200, body: { summary: { cachedLocally: true } },
    });

    expect(connections).toBe(1);
  });
});

function request(scope = 'mall:test'): OperationRequest {
  return {
    type: 'reporting.dashboard.read',
    access: {
      actor: { id: 'principal:operator', session: 'session:operator', membership: 'membership:operator', credentialVersion: 1,
        accessVersion: 1, target: 'console', assurance: { level: 1 } },
      membership: { id: 'membership:operator', active: true, accessVersion: 1, denies: [], grants: [] },
      scope: { id: scope, kind: 'mall', path: [] },
      mallContext: { mall_id: scope }, mall_id: scope, accessVersion: 1,
      capabilities: ['reporting.dashboard.read'], assurance: { level: 1 }, trace: 'trace:dashboard',
    },
    input: {
      path: {}, query: { period: '30days', limit: '100' }, headers: {}, body: null, rawBody: '',
      deadline: Date.now() + 10_000, signal: new AbortController().signal,
    },
  };
}

function context(pool: DatabasePool, cache?: Cache): ModuleContext {
  const container = new Container();
  container.bind(DATABASE_POOL, pool);
  if (cache) container.bind(CACHE, cache);
  container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
  return { container } as unknown as ModuleContext;
}

function databasePool(methods: Pick<DatabasePool, 'connect' | 'query'>): DatabasePool {
  const pool: DatabasePool = {
    ...methods,
    workload: () => pool,
    end: async () => undefined,
  };
  return pool;
}

function memoryCache(
  get: Cache['get'],
  put: Cache['put'] = async () => true,
): Cache {
  return {
    start: async () => undefined,
    onUnavailable: () => () => undefined,
    get,
    put,
    remove: async () => true,
    state: () => ({ available: true }),
    close: async () => undefined,
  };
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
