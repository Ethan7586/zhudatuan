import type { JobDeadletter, JobProcessor } from './JobRunner';
import type { JobKind } from './JobCatalog';

export interface ModuleJob {
  readonly id: JobKind;
  readonly processor: JobProcessor;
  readonly deadletter?: JobDeadletter;
  readonly resourceLeasePrefix?: string;
}

export interface ModuleJobs {
  add(binding: ModuleJob): void;
}
