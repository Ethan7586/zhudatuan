import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { ExtensionLoader, ExtensionRepositoryFactory, ExtensionStateSink } from '../../application/port/ExtensionLoader';
import { HealthRecord } from '../../domain/model/HealthRecord';
import type { ProviderMetrics } from '../../../../foundation/telemetry/ProviderMetrics';
import { safeErrorCode } from '../../../../foundation/domain/SafeError';
import { applyJobDatabaseContext } from '../../../../foundation/infrastructure/DatabaseContext';

export class ExtensionHealthJobProcessor implements JobProcessor {
  constructor(
    private readonly pool: DatabasePool,
    private readonly repositories: ExtensionRepositoryFactory,
    private readonly loader: ExtensionLoader,
    private readonly states: ExtensionStateSink,
    private readonly metrics: ProviderMetrics
  ) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'extensionhealth') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = record(job.payload);
    if (payload.scan === true) return this.scan(signal);
    const installation = text(payload.installation, 'EXTENSION_INSTALLATION_REQUIRED');
    const scope = text(job.scope_id, 'EXTENSION_SCOPE_REQUIRED');
    const started = performance.now();
    const context = { requestId: job.id, traceId: job.id, scopeId: scope, module: 'extension', operation: 'extension.health' };
    let candidate;
    try {
      candidate = await this.loader.stage(installation, { tenant: '', membership: '', scope, actor: 'system:extensionhealth', trace: job.id, workload: 'worker' });
      this.metrics.observe(candidate.provider, 'health', context, performance.now() - started, candidate.health.state === 'healthy' ? 'success' : 'failure', candidate.health.reason);
    } catch (cause) {
      this.metrics.observe(installation, 'health', context, performance.now() - started, 'failure', safeErrorCode(cause, 'PROVIDER_HEALTH_FAILED'));
      throw cause;
    }
    let replace = false;
    let consumed = false;
    try {
      const client = await this.pool.connect();
      try {
        await client.query('begin');
        await applyJobDatabaseContext(client);
        const repository = this.repositories(client);
        const current = await repository.lock(installation, scope);
        if (current && current.version === candidate.version && ['testing', 'enabled', 'degraded'].includes(current.state)) {
          await repository.health(new HealthRecord(current.id, current.version, candidate.health.state, candidate.health.checkedAt, candidate.latency, candidate.health.reason));
          if (candidate.health.state !== 'healthy' && current.state === 'enabled') {
            await repository.transition(current, 'degraded', 'system:extensionhealth', { reason: candidate.health.reason ?? 'health check failed', health: candidate.health, latency: candidate.latency, trace: job.id });
            await this.states.degrade(client, installation, scope);
          }
          await repository.enqueueHealth(installation, scope, 60);
          replace = current.state === 'enabled' && candidate.health.state === 'healthy' && !this.loader.active(candidate);
        }
        await client.query('commit');
      } catch (cause) {
        await client.query('rollback');
        throw cause;
      } finally {
        client.release();
      }
      if (replace) {
        await this.loader.activate(candidate);
        consumed = true;
      }
    } finally {
      if (!consumed) await this.loader.discard(candidate);
    }
  }

  private async scan(signal: AbortSignal): Promise<void> {
    await this.loader.reconcile();
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await applyJobDatabaseContext(client);
      const repository = this.repositories(client);
      const targets = await repository.targets(100);
      for (const target of targets) {
        if (signal.aborted) throw signal.reason;
        await repository.enqueueHealth(target.id, target.scope_id);
      }
      await repository.enqueueScan(targets.length === 100 ? 1 : 60);
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value;
}
