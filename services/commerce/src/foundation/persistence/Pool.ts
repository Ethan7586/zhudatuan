import { performance } from 'node:perf_hooks';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { Pool as PgPool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { token } from '../../bootstrap/Container';
import { QueryMetrics, type DatabaseWorkload } from './QueryMetrics';

export interface DatabasePool {
  connect(): Promise<PoolClient>;
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
  workload(workload: DatabaseWorkload): DatabasePool;
  end(): Promise<void>;
}

export type PoolProfile = 'api' | 'jobs' | 'migration';
export const DATABASE_POOL = token<DatabasePool>('database.pool');

export function createPool(connection: string, profile: PoolProfile, metrics = new QueryMetrics()): DatabasePool {
  if (!connection.startsWith('postgres://') && !connection.startsWith('postgresql://')) throw new Error('DATABASE_CONNECTION_INVALID');
  const workloads: readonly DatabaseWorkload[] = profile === 'api' ? ['query', 'command'] : profile === 'jobs' ? ['worker'] : ['migration'];
  const pools = new Map(workloads.map((workload) => [workload, new PgPool({ connectionString: connection, ...poolConfiguration(workload) })]));
  return new PoolSet(pools, workloads[0]!, metrics);
}

export function poolConfiguration(workload: DatabaseWorkload): Readonly<{
  max: number; connectionTimeoutMillis: number; idleTimeoutMillis: number; application_name: string; options: string;
}> {
  const limits = RUNTIME_LIMITS.pool[workload];
  return Object.freeze({
    max: limits.maximumConnections,
    connectionTimeoutMillis: limits.connectionTimeoutMilliseconds,
    idleTimeoutMillis: limits.idleTimeoutMilliseconds,
    application_name: `shop-${workload}`,
    options: `-c statement_timeout=${limits.statementTimeoutMilliseconds} -c idle_in_transaction_session_timeout=${limits.idleTransactionTimeoutMilliseconds}`,
  });
}

class PoolSet implements DatabasePool {
  constructor(private readonly pools: ReadonlyMap<DatabaseWorkload, PgPool>, private readonly selected: DatabaseWorkload,
    private readonly metrics: QueryMetrics, private readonly owner = true) {}

  async connect(): Promise<PoolClient> {
    const pool = this.selectedPool();
    const started = performance.now();
    try {
      const client = await pool.connect();
      this.metrics.observe(this.selected, performance.now() - started, false);
      return measuredClient(client, this.selected, this.metrics);
    } catch (cause) {
      this.metrics.observe(this.selected, performance.now() - started, true);
      throw cause;
    }
  }

  async query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>> {
    const started = performance.now();
    try {
      const result = await this.selectedPool().query<R>(text, values as unknown[] | undefined);
      this.metrics.observe(this.selected, performance.now() - started, false);
      return result;
    } catch (cause) {
      this.metrics.observe(this.selected, performance.now() - started, true);
      throw cause;
    }
  }

  workload(workload: DatabaseWorkload): DatabasePool {
    if (!this.pools.has(workload)) throw new Error(`DATABASE_WORKLOAD_UNAVAILABLE:${workload}`);
    return new PoolSet(this.pools, workload, this.metrics, false);
  }

  async end(): Promise<void> {
    if (!this.owner) return;
    await Promise.all([...this.pools.values()].map((pool) => pool.end()));
  }

  private selectedPool(): PgPool {
    const pool = this.pools.get(this.selected);
    if (!pool) throw new Error(`DATABASE_WORKLOAD_UNAVAILABLE:${this.selected}`);
    return pool;
  }
}

function measuredClient(client: PoolClient, workload: DatabaseWorkload, metrics: QueryMetrics): PoolClient {
  const query = client.query.bind(client);
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property !== 'query') return Reflect.get(target, property, receiver) as unknown;
      return async (...arguments_: unknown[]) => {
        const started = performance.now();
        try {
          const result = await Reflect.apply(query, client, arguments_);
          metrics.observe(workload, performance.now() - started, false);
          return result;
        } catch (cause) {
          metrics.observe(workload, performance.now() - started, true);
          throw cause;
        }
      };
    },
  });
}
