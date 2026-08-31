import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK, type AuditSink } from '../AuditSink';
import { runtimeReadiness } from '../../../bootstrap/RuntimeReadiness';
import type { OperationRequest, OperationResult, OperationUsecase } from '../OperationHandler';
import { DATABASE_POOL, type DatabasePool } from '../../persistence/Pool';
import { CACHE, type Cache } from '../../cache/Cache';
import { QUERY_METRICS, type QueryMetrics } from '../../persistence/QueryMetrics';
import { applyApiDatabaseContext } from '../../infrastructure/DatabaseContext';
import { EXTENSION_REGISTRY, type ExtensionRegistry } from '../../../bootstrap/ExtensionRegistry';
import { requireSession } from '../../security/OperationSecurityContext';
import { INVITATION_KEY_VERSIONS } from '../../infrastructure/SecretStore';

class RuntimeOperations implements OperationUsecase {
  constructor(
    private readonly pool: DatabasePool,
    private readonly cache: Cache,
    private readonly metrics: QueryMetrics,
    private readonly extensions: ExtensionRegistry,
    private readonly audit: AuditSink,
    private readonly invitationKeyVersions: readonly string[]
  ) {}

  async invoke(request: OperationRequest): Promise<OperationResult> {
    if (request.type === 'runtime.health.live') return { status: 200, body: { status: 'live', eventLoop: 'responsive' } };
    if (request.type === 'runtime.health.startup') return this.readiness('started', 'blocked');
    if (request.type === 'runtime.health.ready') return this.readiness('ready', 'unready');
    if (request.type === 'runtime.health.dependency') return this.dependencies(request);
    throw new Error('OPERATION_ACTION_MISSING');
  }

  private async readiness(success: string, failure: string): Promise<OperationResult> {
    const state = await runtimeReadiness(this.pool, this.extensions, 'api', this.invitationKeyVersions);
    return { status: state.healthy ? 200 : 503, body: { status: state.healthy ? success : failure, ...state } };
  }

  private async dependencies(request: OperationRequest): Promise<OperationResult> {
    const access = requireSession(request.security);
    const [result, readiness] = await Promise.all([
      this.pool.query<{ queued: number; running: number; deadletters: number; oldest_seconds: number }>(
        "select count(*) filter(where state='queued')::integer queued," +
          "count(*) filter(where state='running')::integer running," +
          '(select count(*)::integer from runtime.deadletter where reviewed_at is null) deadletters,' +
          "coalesce(extract(epoch from (clock_timestamp()-(min(created_at) filter(where state='queued')))),0)::integer oldest_seconds from runtime.job"
      ),
      runtimeReadiness(this.pool, this.extensions, 'api', this.invitationKeyVersions),
    ]);
    const response = {
      status: readiness.healthy ? 200 : 503,
      body: {
        status: readiness.healthy ? 'available' : 'degraded',
        queue: result.rows[0],
        cache: this.cache.state(),
        databaseQueries: this.metrics.snapshot(),
        readiness,
      },
    } satisfies OperationResult;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await applyApiDatabaseContext(client, { tenant: access.scope.tenant ?? '', membership: access.membership.id, scope: access.scope.id, actor: access.actor.id, trace: access.trace });
      await this.audit.access(client, {
        scope: access.scope.id,
        actor: access.actor.id,
        actorType: access.actor.target,
        resourceType: 'runtime',
        resource: 'dependencies',
        fields: { operation: request.type, projection: ['status', 'queue', 'cache', 'databaseQueries', 'readiness'] },
        purpose: request.type,
        trace: access.trace,
      });
      await client.query('commit');
      return response;
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}

export function runtimeOperations(context: ModuleContext): OperationUsecase {
  return new RuntimeOperations(context.service(DATABASE_POOL), context.service(CACHE), context.service(QUERY_METRICS), context.service(EXTENSION_REGISTRY), context.service(AUDIT_SINK), context.service(INVITATION_KEY_VERSIONS));
}
