import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import { mapParallel } from '../../../../foundation/performance/Parallel';
import type { ProviderResolver } from '../service/ProviderResolver';
import { safeErrorCode } from '../../../../foundation/domain/SafeError';
import type { ProviderHealthRepository } from '../port/ProviderHealthRepository';

export class MonitorIdentityProviders {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly resolver: ProviderResolver,
    private readonly repository: ProviderHealthRepository,
    private readonly concurrency: number
  ) {}
  async execute(requested: string | null, scope: string, trace: string, signal: AbortSignal, deadline: number): Promise<void> {
    const ids = await this.transactions.read(options(scope, trace, signal, deadline, 'list'), (context) => this.repository.enabled(context, requested));
    await mapParallel(ids, this.concurrency, async (id) => {
      const started = performance.now();
      let status: 'healthy' | 'degraded' | 'unavailable' = 'unavailable';
      let error: string | null = null;
      try {
        const value = await this.transactions.read(options(scope, trace, signal, deadline, `load:${id}`), (context) => this.resolver.require(context, id));
        status = (await value.strategy.health(value.instance)).status;
      } catch (cause) {
        error = code(cause);
      }
      await this.transactions.write(options(scope, trace, signal, deadline, `record:${id}`), (context) => this.repository.record(context, id, status, Math.ceil(performance.now() - started), error));
    });
  }
}
function options(scope: string, trace: string, signal: AbortSignal, deadline: number, action: string) {
  return { tenant: '', membership: '', scope, actor: 'job:providerhealth', trace, operation: `job.identity.providerhealth.${action}`, workload: 'jobs' as const, signal, deadline };
}
function code(value: unknown): string {
  return safeErrorCode(value, 'IDENTITY_PROVIDER_UNAVAILABLE');
}
