import { CommandBus } from '../foundation/application/CommandBus';
import { QueryBus } from '../foundation/application/QueryBus';
import type { Telemetry } from '@shop/telemetry';
import { HttpApp } from '../foundation/interface/HttpApp';
import { OperationMetrics } from '../foundation/telemetry/OperationMetrics';
import { Container } from './Container';
import type { ExtensionRegistry } from './ExtensionRegistry';
import { JobRegistry } from './JobRegistry';
import type { CommerceModule } from './ModuleRegistry';
import { ModuleRegistry } from './ModuleRegistry';
import { RouteRegistry } from './RouteRegistry';
<<<<<<< HEAD
<<<<<<< HEAD
import type { OperationId } from '@shop/contract';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import type { OperationId } from '@shop/contract';
>>>>>>> 018b2a71 (chore(release): capture current production source)

export interface ApiBootstrapOptions {
  readonly modules: readonly CommerceModule[];
  readonly extensions: ExtensionRegistry;
  readonly configure?: (container: Container) => void | Promise<void>;
  readonly allowedOrigins: readonly string[];
  readonly telemetry: Telemetry;
<<<<<<< HEAD
<<<<<<< HEAD
  readonly operationIds?: readonly OperationId[];
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  readonly operationIds?: readonly OperationId[];
>>>>>>> 018b2a71 (chore(release): capture current production source)
}

export async function bootstrapApi(options: ApiBootstrapOptions): Promise<Readonly<{ app: HttpApp; modules: readonly string[]; routes: RouteRegistry }>> {
  const container = new Container();
  await options.configure?.(container);
  const commands = new CommandBus();
  const queries = new QueryBus();
<<<<<<< HEAD
<<<<<<< HEAD
  const routes = new RouteRegistry(options.operationIds);
=======
  const routes = new RouteRegistry();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const routes = new RouteRegistry(options.operationIds);
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const jobs = new JobRegistry();
  const modules = new ModuleRegistry();
  for (const module of options.modules) modules.add(module);
  await modules.load({ workload: 'api', container, commands, queries, routes, jobs, extensions: options.extensions });
  commands.freeze();
  queries.freeze();
  routes.freeze();
  jobs.freeze();
  options.extensions.freeze();
  container.freeze();
  return Object.freeze({ app: new HttpApp(routes, options.allowedOrigins, undefined, undefined, new OperationMetrics(options.telemetry)),
    modules: modules.catalog(), routes });
}
