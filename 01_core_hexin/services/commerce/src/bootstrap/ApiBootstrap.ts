import { CommandBus } from '../foundation/application/CommandBus';
import { QueryBus } from '../foundation/application/QueryBus';
import type { Telemetry } from '@shop/telemetry';
import {
  createNodeContextResolver,
  materializeNodeManifestRegistryDeclaration,
  type NodeContextResolver,
  type NodeManifestRegistry,
  type NodeManifestRegistryDeclaration,
} from '@shop/config/sfl-node-kernel';
import nodeManifestDeclaration from '../../../../../02_platform_pingtai/config/console-node-manifests.json';
import { HttpApp } from '../foundation/interface/HttpApp';
import { OperationMetrics } from '../foundation/telemetry/OperationMetrics';
import { Container, token } from './Container';
import type { ExtensionRegistry } from './ExtensionRegistry';
import { JobRegistry } from './JobRegistry';
import type { CommerceModule } from './ModuleRegistry';
import { ModuleRegistry } from './ModuleRegistry';
import { RouteRegistry } from './RouteRegistry';
import type { OperationId } from '@shop/contract';
import type { GateEngine } from '../foundation/security/gate_menjin';

export const NODE_MANIFEST_REGISTRY = token<NodeManifestRegistry>('foundation.node-manifest-registry');
export const SERVER_NODE_MANIFEST_REGISTRY = await materializeNodeManifestRegistryDeclaration(
  nodeManifestDeclaration as unknown as NodeManifestRegistryDeclaration,
);

export function bindServerNodeManifestRegistry(container: Container): void {
  container.bind(NODE_MANIFEST_REGISTRY, SERVER_NODE_MANIFEST_REGISTRY);
}

export interface ApiBootstrapOptions {
  readonly modules: readonly CommerceModule[];
  readonly extensions: ExtensionRegistry;
  readonly configure?: (container: Container) => void | Promise<void>;
  readonly allowedOrigins: readonly string[];
  readonly telemetry: Telemetry;
  readonly operationIds?: readonly OperationId[];
  readonly gateEngine?: GateEngine;
  readonly nodeManifestRegistry?: NodeManifestRegistry;
}

export async function bootstrapApi(options: ApiBootstrapOptions): Promise<Readonly<{
  app: HttpApp;
  modules: readonly string[];
  routes: RouteRegistry;
  nodeContextResolver: NodeContextResolver | undefined;
}>> {
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
  const nodeManifestRegistry = options.nodeManifestRegistry
    ?? (container.has(NODE_MANIFEST_REGISTRY) ? container.get(NODE_MANIFEST_REGISTRY) : undefined);
  container.freeze();
  const nodeContextResolver = nodeManifestRegistry === undefined ? undefined : createNodeContextResolver(nodeManifestRegistry);
  return Object.freeze({ app: new HttpApp(routes, options.allowedOrigins, undefined, undefined, new OperationMetrics(options.telemetry),
    options.gateEngine, nodeContextResolver),
    modules: modules.catalog(), routes, nodeContextResolver });
}
