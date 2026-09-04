import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK, type AuditSink } from '../../foundation/application/AuditSink';
import { runtimeCompatibility } from '../../bootstrap/RuntimeCompatibility';
import type { OperationRequest, OperationResult, OperationUsecase } from '../../foundation/application/OperationHandler';
import { DATABASE_POOL, type DatabasePool } from '../../foundation/persistence/Pool';
import { CACHE, type Cache } from '../../foundation/cache/Cache';
import { QUERY_METRICS, type QueryMetrics } from '../../foundation/persistence/QueryMetrics';
import { applyApiDatabaseContext } from '../../foundation/infrastructure/DatabaseContext';

class RuntimeOperations implements OperationUsecase {
  constructor(private readonly pool: DatabasePool, private readonly cache: Cache, private readonly metrics: QueryMetrics,
    private readonly context: ModuleContext, private readonly audit: AuditSink) {}

  async invoke(request: OperationRequest): Promise<OperationResult> {
    if (request.type === 'runtime.health.live') return { status: 200, body: { status: 'live', eventLoop: 'responsive' } };
    if (request.type === 'runtime.health.startup') return this.compatibility('started', 'blocked');
    if (request.type === 'runtime.health.ready') return this.compatibility('ready', 'unready');
    if (request.type === 'runtime.health.dependency') return this.dependencies(request);
    throw new Error('OPERATION_ACTION_MISSING');
  }

  private async compatibility(success: string, failure: string): Promise<OperationResult> {
    const state = await runtimeCompatibility(this.pool, this.context.extensions, 'api');
    return { status: state.healthy ? 200 : 503, body: { status: state.healthy ? success : failure, ...state } };
  }

  private async dependencies(request: OperationRequest): Promise<OperationResult> {
    if (!request.access) throw new Error('AUTHENTICATION_REQUIRED');
    const [result, compatibility] = await Promise.all([
      this.pool.query<{ queued: number; running: number; deadletters: number; oldest_seconds: number }>(
        "select count(*) filter(where state='queued')::integer queued,"
        + "count(*) filter(where state='running')::integer running,"
        + "(select count(*)::integer from runtime.deadletter where reviewed_at is null) deadletters,"
        + "coalesce(extract(epoch from clock_timestamp()-(min(created_at) filter(where state='queued'))),0)::integer oldest_seconds from runtime.job",
      ),
      runtimeCompatibility(this.pool, this.context.extensions, 'api'),
    ]);
    const response = {
      status: compatibility.healthy ? 200 : 503,
      body: {
        status: compatibility.healthy ? 'available' : 'degraded',
        queue: result.rows[0],
        cache: this.cache.state(),
        databaseQueries: this.metrics.snapshot(),
        compatibility,
      },
    } satisfies OperationResult;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await applyApiDatabaseContext(client, { tenant: request.access.scope.tenant ?? '', membership: request.access.membership.id,
        scope: request.access.scope.id, actor: request.access.actor.id, trace: request.access.trace });
      await this.audit.access(client,{ scope:request.access.scope.id, actor:request.access.actor.id, actorType:request.access.actor.target,
        resourceType:'runtime', resource:'dependencies', fields:{ operation:request.type, projection:['status','queue','cache','databaseQueries','compatibility'] },
        purpose:request.type, trace:request.access.trace });
      await client.query('commit');
      return response;
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
}

export function runtimeOperations(context: ModuleContext): OperationUsecase {
  return new RuntimeOperations(context.container.get(DATABASE_POOL), context.container.get(CACHE), context.container.get(QUERY_METRICS), context,
    context.container.get(AUDIT_SINK));
}
