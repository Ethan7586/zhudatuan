import { CommandBus } from '../foundation/application/CommandBus';
import { QueryBus } from '../foundation/application/QueryBus';
import { Container } from './Container';
import type { ExtensionRegistry } from './ExtensionRegistry';
import { JobRegistry } from './JobRegistry';
import type { CommerceModule } from './ModuleRegistry';
import { ModuleRegistry } from './ModuleRegistry';
import { RouteRegistry } from './RouteRegistry';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { registerJobs } from '../app/jobs';

export interface JobsBootstrapOptions {
  readonly modules: readonly CommerceModule[];
  readonly extensions: ExtensionRegistry;
  readonly pool: DatabasePool;
  readonly worker: string;
  readonly configure?: (container: Container) => void | Promise<void>;
}

export async function bootstrapJobs(options: JobsBootstrapOptions): Promise<JobRegistry> {
  const container = new Container();
  await options.configure?.(container);
  const commands = new CommandBus();
  const queries = new QueryBus();
  const routes = new RouteRegistry();
  const jobs = new JobRegistry();
  const modules = new ModuleRegistry();
  for (const module of options.modules) modules.add(module);
  await modules.load({ workload: 'jobs', container, commands, queries, routes, jobs, extensions: options.extensions });
  registerJobs(jobs, container, options.extensions, options.worker);
  commands.freeze();
  queries.freeze();
  jobs.freeze();
  options.extensions.freeze();
  container.freeze();
  return jobs;
}
