import type { Job } from '../foundation/application/Job';

export interface JobDefinition<T = unknown> {
  readonly id: string;
  readonly job: Job<T>;
  readonly lease: number;
  readonly batch: number;
  readonly concurrency: number;
  readonly deadline: number;
}

export class JobRegistry {
  private readonly jobs = new Map<string, JobDefinition>();
  private frozen = false;

  register(definition: JobDefinition): void {
    if (this.frozen) throw new Error('JOB_REGISTRY_FROZEN');
    if (this.jobs.has(definition.id)) throw new Error(`JOB_DUPLICATE:${definition.id}`);
    if (definition.lease < 5 || definition.batch < 1 || definition.concurrency < 1 || definition.deadline < 100) throw new Error(`JOB_CONFIGURATION_INVALID:${definition.id}`);
    this.jobs.set(definition.id, definition);
  }

  freeze(): void {
    this.frozen = true;
  }

  all(): readonly JobDefinition[] {
    if (!this.frozen) throw new Error('JOB_REGISTRY_NOT_FROZEN');
    return Object.freeze([...this.jobs.values()]);
  }
}
