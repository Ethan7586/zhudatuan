import { createHash } from 'node:crypto';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { mapParallel } from '../../../../foundation/performance/Parallel';
import type { CheckoutRetentionPort } from '../../../checkout/public';
import type { PricingRetentionPort } from '../../../pricing/public';
import type { VerificationRetentionPort } from '../../../verification/public';
import type { ClaimedJob } from '../../public/JobProcess';
import type { ObjectStore } from '../../public/ObjectPort';
import type { CleanupEvidence, RuntimeCleanupPorts } from '../port/CleanupPort';

export interface RuntimeCleanupDependencies {
  readonly identity: Readonly<{ purge(context: WriteTransactionContext): Promise<void> }>;
  readonly checkout: CheckoutRetentionPort;
  readonly pricing: PricingRetentionPort;
  readonly verification: VerificationRetentionPort;
}

export interface RuntimeCleanupConfig {
  readonly batch: number;
  readonly objectConcurrency: number;
  readonly inboxDays: number;
  readonly outboxDays: number;
}

export class CleanupRuntime {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly cleanup: RuntimeCleanupPorts,
    private readonly store: Pick<ObjectStore, 'remove'>,
    private readonly dependencies: RuntimeCleanupDependencies,
    private readonly config: RuntimeCleanupConfig
  ) {
    if (![config.batch, config.objectConcurrency, config.inboxDays, config.outboxDays].every(value => Number.isSafeInteger(value) && value > 0)) {
      throw new Error('CLEANUP_CONFIG_INVALID');
    }
  }

  async execute(job: Pick<ClaimedJob, 'id' | 'token'>, signal: AbortSignal, deadline: number): Promise<void> {
    const jobId = job.id;
    const options = (operation: string): TransactionOptions => ({ tenant: '', membership: '', scope: 'runtime', actor: 'job:cleanup',
      trace: jobId, operation, workload: 'jobs', signal, deadline });
    await this.transactions.write(options('job.runtime.cleanup.recover'), async (context) => {
      await this.cleanup.jobs.recover(context, jobId, this.config.batch);
      await this.cleanup.imports.expire(context, this.config.batch);
      await this.dependencies.identity.purge(context);
      const retainedQuotes = await this.dependencies.checkout.purge(context);
      await this.dependencies.pricing.purgeQuotes(context, retainedQuotes);
      await this.dependencies.verification.purge(context);
    });
    const createdAt = new Date().toISOString();
    const inboxBefore = before(Date.parse(createdAt), this.config.inboxDays);
    const outboxBefore = before(Date.parse(createdAt), this.config.outboxDays);
    const plan = await this.transactions.read(options('job.runtime.cleanup.plan'), async (context) => {
      const imports = await this.cleanup.imports.plan(context, this.config.batch);
      const remaining = this.config.batch - imports.ids.length;
      const exports = remaining > 0
        ? await this.cleanup.exports.plan(context, remaining)
        : { ids: Object.freeze([]), objects: Object.freeze([]) };
      const jobs = await this.cleanup.jobs.plan(context, this.config.batch);
      const idempotency = await this.cleanup.control.planIdempotency(context, this.config.batch);
      const deadletters = await this.cleanup.control.planDeadletters(context, this.config.batch);
      const inbox = await this.cleanup.inbox.plan(context, inboxBefore, this.config.batch);
      const outbox = await this.cleanup.outbox.plan(context, outboxBefore, this.config.batch);
      const objects = Object.freeze([...new Set([...imports.objects, ...exports.objects])]);
      return Object.freeze({ version: 1, createdAt, inboxBefore: inboxBefore.toISOString(), outboxBefore: outboxBefore.toISOString(),
        jobs, imports, exports, idempotency, deadletters, inbox, outbox, objects });
    });
    const evidence = cleanupEvidence(plan);
    await this.transactions.write(options('job.runtime.cleanup.plan.record'), context => this.cleanup.jobs.record(context, job, evidence));
    await mapParallel(plan.objects, this.config.objectConcurrency, async (reference) => {
      if (signal.aborted) throw signal.reason ?? new Error('CLEANUP_ABORTED');
      if (Date.now() >= deadline) throw new Error('DEADLINE_EXCEEDED');
      await this.store.remove(reference);
    });
    await this.transactions.write(options('job.runtime.cleanup.purge'), async (context) => {
      const actual = {
        imports: await this.cleanup.imports.purge(context, plan.imports.ids),
        exports: await this.cleanup.exports.purge(context, plan.exports.ids),
        deadletters: await this.cleanup.control.purgeDeadletters(context, plan.deadletters),
        jobs: await this.cleanup.jobs.purge(context, plan.jobs),
        idempotency: await this.cleanup.control.purgeIdempotency(context, plan.idempotency),
        inbox: await this.cleanup.inbox.purge(context, plan.inbox, inboxBefore),
        outbox: await this.cleanup.outbox.purge(context, plan.outbox, outboxBefore),
      };
      assertCleanupCounts(evidence.counts, actual);
    });
  }
}

function before(now: number, days: number): Date {
  return new Date(now - days * 86_400_000);
}

function cleanupEvidence(plan: Readonly<Record<string, unknown>> & {
  readonly createdAt: string; readonly inboxBefore: string; readonly outboxBefore: string;
  readonly jobs: readonly string[]; readonly imports: Readonly<{ ids: readonly string[] }>;
  readonly exports: Readonly<{ ids: readonly string[] }>; readonly idempotency: readonly unknown[];
  readonly deadletters: readonly string[]; readonly inbox: readonly unknown[]; readonly outbox: readonly string[]; readonly objects: readonly string[];
}): CleanupEvidence {
  const counts = Object.freeze({ jobs: plan.jobs.length, imports: plan.imports.ids.length, exports: plan.exports.ids.length,
    idempotency: plan.idempotency.length, deadletters: plan.deadletters.length, inbox: plan.inbox.length,
    outbox: plan.outbox.length, objects: plan.objects.length });
  return Object.freeze({ hash: createHash('sha256').update(JSON.stringify(plan)).digest('hex'), createdAt: plan.createdAt,
    inboxBefore: plan.inboxBefore, outboxBefore: plan.outboxBefore, counts });
}

function assertCleanupCounts(expected: Readonly<Record<string, number>>, actual: Readonly<Record<string, number>>): void {
  for (const [kind, count] of Object.entries(actual)) {
    if (expected[kind] !== count) throw new Error(`CLEANUP_BOUNDARY_CHANGED:${kind}:${expected[kind]}:${count}`);
  }
}
