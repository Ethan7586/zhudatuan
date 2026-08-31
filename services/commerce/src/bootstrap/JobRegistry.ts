import type { Job } from '../foundation/application/Job';

export interface JobDefinition<T = unknown> {
  readonly id: string;
  readonly job: Job<T>;
  readonly lease: number;
  readonly batch: number;
  readonly concurrency: number;
  readonly deadline: number;
  readonly resourceLease?: Readonly<{ prefix: string; seconds: number }>;
}

export class JobRegistry {
  private readonly jobs = new Map<string, JobDefinition>();
  private frozen = false;

  register(definition: JobDefinition): void {
    if (this.frozen) throw new Error('JOB_REGISTRY_FROZEN');
    if (this.jobs.has(definition.id)) throw new Error(`JOB_DUPLICATE:${definition.id}`);
    if (definition.lease < 5 || definition.batch < 1 || definition.concurrency < 1 || definition.deadline < 100) throw new Error(`JOB_CONFIGURATION_INVALID:${definition.id}`);
    if (definition.resourceLease && (!/^[a-z][a-z0-9]*$/.test(definition.resourceLease.prefix) || definition.resourceLease.seconds < definition.lease || definition.resourceLease.seconds > 900))
      throw new Error(`JOB_RESOURCE_LEASE_INVALID:${definition.id}`);
    const resourceLease = definition.resourceLease === undefined ? undefined : Object.freeze({ ...definition.resourceLease });
    this.jobs.set(definition.id, Object.freeze({ ...definition, ...(resourceLease === undefined ? {} : { resourceLease }) }));
  }

  freeze(): void {
    this.frozen = true;
  }

  all(): readonly JobDefinition[] {
    if (!this.frozen) throw new Error('JOB_REGISTRY_NOT_FROZEN');
    return Object.freeze([...this.jobs.values()]);
  }
}
