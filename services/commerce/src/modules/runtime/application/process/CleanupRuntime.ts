import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { CheckoutRetentionPort } from '../../../checkout/public';
import type { PricingRetentionPort } from '../../../pricing/public';
import type { CleanupRepository } from '../port/CleanupRepository';

export interface RuntimeCleanupDependencies {
  readonly identity: Readonly<{ purge(context: Parameters<CleanupRepository['prepare']>[0]): Promise<void> }>;
  readonly checkout: CheckoutRetentionPort;
  readonly pricing: PricingRetentionPort;
}

export class CleanupRuntime {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: CleanupRepository,
    private readonly dependencies: RuntimeCleanupDependencies
  ) {}

  execute(jobId: string, signal: AbortSignal, deadline: number): Promise<void> {
    return this.transactions.write(
      {
        tenant: '',
        membership: '',
        scope: 'runtime',
        actor: 'job:cleanup',
        trace: jobId,
        operation: 'job.runtime.cleanup',
        workload: 'jobs',
        signal,
        deadline,
      },
      async (context) => {
        await this.repository.prepare(context, jobId);
        await this.dependencies.identity.purge(context);
        const retainedQuotes = await this.dependencies.checkout.purge(context);
        await this.dependencies.pricing.purgeQuotes(context, retainedQuotes);
        await this.repository.complete(context);
      }
    );
  }
}
