import type { ExtensionLoader, ExtensionRepository, ExtensionStateSink } from '../port/ExtensionLoader';
import { HealthRecord } from '../../domain/model/HealthRecord';
import type { ProviderMetrics } from '../../../../foundation/telemetry/ProviderMetrics';
import { safeErrorCode } from '../../../../foundation/domain/SafeError';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';

export class MonitorExtensions {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: ExtensionRepository,
    private readonly loader: ExtensionLoader,
    private readonly states: ExtensionStateSink,
    private readonly metrics: ProviderMetrics
  ) {}

  async check(installation: string, scope: string, trace: string, signal: AbortSignal, deadline: number): Promise<void> {
    const started = performance.now();
    const context = { requestId: trace, traceId: trace, scopeId: scope, module: 'extension', operation: 'extension.health' };
    let candidate;
    try {
      candidate = await this.loader.stage(installation, { tenant: '', membership: '', scope, actor: 'system:extensionhealth', trace, workload: 'worker', signal, deadline });
      this.metrics.observe(candidate.provider, 'health', context, performance.now() - started, candidate.health.state === 'healthy' ? 'success' : 'failure', candidate.health.reason);
    } catch (cause) {
      this.metrics.observe(installation, 'health', context, performance.now() - started, 'failure', safeErrorCode(cause, 'PROVIDER_HEALTH_FAILED'));
      throw cause;
    }
    let replace = false;
    let consumed = false;
    try {
      await this.transactions.write(options(trace, scope, signal, deadline), async (context) => {
        const current = await this.repository.lock(context, installation, scope);
        if (current && current.version === candidate.version && ['testing', 'enabled', 'degraded'].includes(current.state)) {
          await this.repository.health(context, new HealthRecord(current.id, current.version, candidate.health.state, candidate.health.checkedAt, candidate.latency, candidate.health.reason));
          if (candidate.health.state !== 'healthy' && current.state === 'enabled') {
            await this.repository.transition(context, current, 'degraded', 'system:extensionhealth', { reason: candidate.health.reason ?? 'health check failed', health: candidate.health, latency: candidate.latency, trace });
            await this.states.degrade(context, installation, scope);
          }
          await this.repository.enqueueHealth(context, installation, scope, 60);
          replace = current.state === 'enabled' && candidate.health.state === 'healthy' && !this.loader.active(candidate);
        }
      });
      if (replace) {
        await this.loader.activate(candidate);
        consumed = true;
      }
    } finally {
      if (!consumed) await this.loader.discard(candidate);
    }
  }

  async scan(signal: AbortSignal, deadline: number): Promise<void> {
    await this.loader.reconcile();
    await this.transactions.write(options('extensionhealth:scan', 'extension', signal, deadline), async (context) => {
      const targets = await this.repository.targets(context, 100);
      for (const target of targets) {
        if (signal.aborted) throw signal.reason;
        await this.repository.enqueueHealth(context, target.id, target.scope_id);
      }
      await this.repository.enqueueScan(context, targets.length === 100 ? 1 : 60);
    });
  }
}

function options(trace: string, scope: string, signal: AbortSignal, deadline: number) {
  return { tenant: '', membership: '', scope, actor: 'job:extensionhealth', trace, operation: 'job.extension.health', workload: 'jobs' as const, signal, deadline };
}
