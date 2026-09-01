import { HandlerRegistry } from '../foundation/application/HandlerRegistry';
import { Container } from './Container';
import type { ExtensionRegistry } from './ExtensionRegistry';
import { JobRegistry } from './JobRegistry';
import type { CommerceModule } from './ModuleRegistry';
import { ModuleRegistry } from './ModuleRegistry';
import type { DatabasePool } from '../foundation/persistence/Pool';
import type { EventRegistry } from './EventRegistry';

export interface JobsBootstrapOptions {
  readonly modules: readonly CommerceModule[];
  readonly extensions: ExtensionRegistry;
  readonly pool: DatabasePool;
  readonly worker: string;
  readonly configure?: (container: Container) => void | Promise<void>;
}

export async function bootstrapJobs(options: JobsBootstrapOptions): Promise<Readonly<{ jobs: JobRegistry; events: EventRegistry }>> {
  const container = new Container();
  await options.configure?.(container);
  const handlers = new HandlerRegistry();
  const jobs = new JobRegistry();
  const modules = new ModuleRegistry();
  for (const module of options.modules) modules.add(module);
  await modules.load({ workload: 'jobs', container, handlers, jobs, worker: options.worker });
  jobs.freeze();
  options.extensions.freeze();
  container.freeze();
  return Object.freeze({ jobs, events: modules.events() });
}
