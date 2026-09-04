import { HandlerRegistry } from '../foundation/application/HandlerRegistry';
import { Container } from './Container';
import type { ExtensionRegistry } from './ExtensionRegistry';
import { JobRegistry } from '../modules/runtime/application/registry/JobRegistry';
import type { CommerceModule } from './ModuleRegistry';
import { ModuleRegistry } from './ModuleRegistry';
import type { DatabasePool } from '../foundation/persistence/Pool';
import type { EventRegistry } from './EventRegistry';
import { WorkerRegistry } from '../modules/runtime/application/registry/WorkerRegistry';
import { ProcessorRegistry } from '../modules/runtime/application/registry/ProcessorRegistry';

export interface JobsBootstrapOptions {
  readonly modules: readonly CommerceModule[];
  readonly extensions: ExtensionRegistry;
  readonly pool: DatabasePool;
  readonly worker: string;
  readonly configure?: (container: Container) => void | Promise<void>;
}

export async function bootstrapJobs(options: JobsBootstrapOptions): Promise<Readonly<{ jobs: JobRegistry; workers: WorkerRegistry; processors: ProcessorRegistry; events: EventRegistry }>> {
  const container = new Container();
  await options.configure?.(container);
  const handlers = new HandlerRegistry();
  const jobs = new JobRegistry();
  const workers = new WorkerRegistry();
  const modules = new ModuleRegistry();
  for (const module of options.modules) modules.add(module);
  await modules.load({ workload: 'jobs', container, handlers, jobs, workers, worker: options.worker });
  jobs.freeze();
  const processors = new ProcessorRegistry(jobs);
  options.extensions.freeze();
  container.freeze();
  return Object.freeze({ jobs, workers, processors, events: modules.events() });
}
