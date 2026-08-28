import { CommandBus } from '../foundation/application/CommandBus';
import { QueryBus } from '../foundation/application/QueryBus';
import type { Telemetry } from '@shop/telemetry';
import type { OperationId } from '@shop/contract';
import { HttpApp } from '../foundation/interface/HttpApp';
import { OperationMetrics } from '../foundation/telemetry/OperationMetrics';
import { Container } from './Container';
import type { ExtensionRegistry } from './ExtensionRegistry';
import { JobRegistry } from './JobRegistry';
import type { CommerceModule } from './ModuleRegistry';
import { ModuleRegistry } from './ModuleRegistry';
import { RouteRegistry } from './RouteRegistry';

export interface ApiBootstrapOptions {
  readonly modules: readonly CommerceModule[];
  readonly extensions: ExtensionRegistry;
  readonly configure?: (container: Container) => void | Promise<void>;
  readonly allowedOrigins: readonly string[];
  readonly telemetry: Telemetry;
  readonly operationIds?: readonly OperationId[];
}

export async function bootstrapApi(options: ApiBootstrapOptions): Promise<Readonly<{ app: HttpApp; modules: readonly string[]; routes: RouteRegistry }>> {
  const container = new Container();
  await options.configure?.(container);
  const commands = new CommandBus();
  const queries = new QueryBus();
  const routes = new RouteRegistry(options.operationIds);
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
