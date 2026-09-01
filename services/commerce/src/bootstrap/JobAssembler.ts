import { PgDeadletterStore } from '../adapter/database/PgDeadletterStore';
import { PgJobRepository } from '../adapter/database/PgJobRepository';
import { PgTransactionManager } from '../adapter/database/PgTransactionManager';
import { JOB_CATALOG, PROVIDER_JOB_IDS, jobDefinition } from '../foundation/application/JobCatalog';
import type { ModuleJob } from '../foundation/application/ModuleJob';
import { QueueJob } from '../foundation/infrastructure/QueueJob';
import { DATABASE_POOL } from '../foundation/persistence/Pool';
import { JobMetrics } from '../foundation/telemetry/JobMetrics';
import { TELEMETRY } from '../foundation/telemetry/Telemetry';
import type { Container } from './Container';
import type { JobRegistry } from './JobRegistry';

const providerJobs = new Set<string>(PROVIDER_JOB_IDS);

export class JobAssembler {
  private readonly transactions;
  private readonly metrics;
  private registrations = 0;

  constructor(
    private readonly registry: JobRegistry,
    container: Container,
    private readonly worker: string,
    private readonly workload: 'jobs' | 'provider',
    private readonly batch: number,
    private readonly poll: number
  ) {
    this.transactions = new PgTransactionManager(container.get(DATABASE_POOL));
    this.metrics = new JobMetrics(container.get(TELEMETRY));
  }

  add(owner: string, binding: ModuleJob): void {
    const definition = jobDefinition(binding.id);
    if (definition.owner !== owner) throw new Error(`JOB_OWNER_MISMATCH:${binding.id}:${owner}:${definition.owner}`);
    if ((this.workload === 'provider') !== providerJobs.has(binding.id)) throw new Error(`JOB_WORKLOAD_MISMATCH:${binding.id}:${this.workload}`);
    const job = new QueueJob(
      definition.id,
      this.transactions,
      new PgJobRepository(),
      new PgDeadletterStore(),
      {
        worker: this.worker,
        workload: this.workload,
        owner,
        batch: this.batch,
        poll: this.poll,
        lease: definition.lease,
        concurrency: definition.concurrency,
        attempts: definition.retry.attempts,
        deadline: definition.timeout,
        retryMinimum: definition.retry.minimum,
        retryMaximum: definition.retry.maximum,
      },
      binding.processor,
      binding.deadletter,
      this.metrics
    );
    this.registry.register({
      id: definition.id,
      job,
      lease: definition.lease,
      batch: this.batch,
      concurrency: definition.concurrency,
      deadline: definition.timeout,
      ...(binding.resourceLeasePrefix ? { resourceLease: { prefix: binding.resourceLeasePrefix, seconds: definition.lease } } : {}),
    });
    this.registrations += 1;
  }

  expected(): number {
    return JOB_CATALOG.filter(({ id }) => providerJobs.has(id) === (this.workload === 'provider')).length;
  }

  assertComplete(): void {
    if (this.registrations !== this.expected()) throw new Error(`JOB_REGISTRY_INCOMPLETE:${this.registrations}:${this.expected()}`);
  }
}
