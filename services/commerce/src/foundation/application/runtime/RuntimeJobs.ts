import type { ClaimedJob, JobProcessor } from '../JobRunner';
import type { OperationDatabase } from '../ModuleOperations';
import type { DatabasePool } from '../../persistence/Pool';
import type { CheckoutRetentionPort } from '../../../modules/checkout/public/index';
import type { PricingRetentionPort } from '../../../modules/pricing/public/index';

export interface RuntimeJobDependencies {
  readonly identity: Readonly<{ purge(database: OperationDatabase): Promise<void> }>;
  readonly checkout: CheckoutRetentionPort;
  readonly pricing: PricingRetentionPort;
}

export class RuntimeJobProcessor implements JobProcessor {
  constructor(
    private readonly pool: DatabasePool,
    private readonly dependencies: RuntimeJobDependencies
  ) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'cleanup') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `update runtime.job set state='queued',lease_owner=null,lease_deadline=null,updated_at=clock_timestamp()
        where state='running' and lease_deadline<clock_timestamp() and id<>$1`,
        [job.id]
      );
      await client.query(`delete from runtime.idempotency where expires_at<clock_timestamp() and state<>'started'`);
      await this.dependencies.identity.purge(client);
      const retainedQuotes = await this.dependencies.checkout.purge(client);
      await this.dependencies.pricing.purgeQuotes(client, retainedQuotes);
      await client.query(`delete from runtime.job where state in('completed','cancelled') and updated_at<clock_timestamp()-interval '30 days'`);
      await client.query(`delete from runtime.inbox where processed_at<clock_timestamp()-interval '90 days'`);
      await client.query(`delete from runtime.outbox where published_at<clock_timestamp()-interval '90 days'`);
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}
