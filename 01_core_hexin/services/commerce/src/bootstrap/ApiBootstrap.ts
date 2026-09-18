import { CommandBus } from '../foundation/application/CommandBus';
import { QueryBus } from '../foundation/application/QueryBus';
import type { Telemetry } from '@shop/telemetry';
import {
  createNodeContextResolver,
  materializeNodeManifestRegistryDeclaration,
  SFL_NODE_MANIFEST_REGISTRY_SCHEMA_VERSION,
  type NodeContextResolver,
  type NodeManifest,
  type NodeManifestRegistry,
} from '@shop/config/sfl-node-kernel';
import { SFL_NODE_MANIFEST_REGISTRY_DECLARATION } from '@shop/config/sfl-node-registry';
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
import { ArchBoard } from '@shop/l-kernel/arch';
import { ARCH_BOARD } from './ArchOperationAdapter';

export const NODE_MANIFEST_REGISTRY = token<NodeManifestRegistry>('foundation.node-manifest-registry');
export const SERVER_NODE_MANIFEST_REGISTRY = await materializeNodeManifestRegistryDeclaration(
  SFL_NODE_MANIFEST_REGISTRY_DECLARATION,
);

export function bindServerNodeManifestRegistry(
  container: Container,
  registry: NodeManifestRegistry = SERVER_NODE_MANIFEST_REGISTRY,
): void {
  container.bind(NODE_MANIFEST_REGISTRY, registry);
}

export function singleNodeManifestRegistry(manifest: NodeManifest): NodeManifestRegistry {
  return Object.freeze({
    schema_version: SFL_NODE_MANIFEST_REGISTRY_SCHEMA_VERSION,
    registry_version: `runtime:${manifest.manifest_id}:${manifest.manifest_version}`,
    generated_at: manifest.generated_at,
    manifests: Object.freeze([manifest]),
  });
}

export function runtimeNodeManifestRegistry(manifest: NodeManifest): NodeManifestRegistry {
  if (manifest.signed_level === 'L0') return SERVER_NODE_MANIFEST_REGISTRY;
  return Object.freeze({
    ...SERVER_NODE_MANIFEST_REGISTRY,
    registry_version: `runtime:${manifest.manifest_id}:${manifest.manifest_version}`,
    generated_at: manifest.generated_at,
    manifests: Object.freeze([
      ...SERVER_NODE_MANIFEST_REGISTRY.manifests.filter((candidate) => candidate.node_id !== manifest.node_id),
      manifest,
    ]),
  });
}

export interface ApiBootstrapOptions {
  readonly modules: readonly CommerceModule[];
  readonly extensions: ExtensionRegistry;
  readonly configure?: (container: Container) => void | Promise<void>;
  readonly allowedOrigins: readonly string[];
  readonly allowedOriginSurfaces?: readonly string[];
  readonly telemetry: Telemetry;
  readonly operationIds?: readonly OperationId[];
  readonly gateEngine?: GateEngine;
  readonly nodeManifestRegistry?: NodeManifestRegistry;
  readonly arch?: ArchBoard;
  readonly archMountNodeIds?: readonly string[];
}

export async function bootstrapApi(options: ApiBootstrapOptions): Promise<Readonly<{
  app: HttpApp;
  modules: readonly string[];
  routes: RouteRegistry;
  arch: ArchBoard;
  nodeContextResolver: NodeContextResolver | undefined;
}>> {
  const container = new Container();
  await options.configure?.(container);
  const commands = new CommandBus();
  const queries = new QueryBus();
  const routes = new RouteRegistry(options.operationIds);
  const arch = options.arch ?? new ArchBoard();
  container.bind(ARCH_BOARD, arch);
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
  if (nodeManifestRegistry !== undefined) arch.mountAll(
    nodeManifestRegistry.manifests
      .filter((candidate) => options.archMountNodeIds === undefined || options.archMountNodeIds.includes(candidate.node_id))
      .map((manifest) => manifest.node_id),
    routes.catalog().map(({ operation }) => operation),
  );
  container.freeze();
  const nodeContextResolver = nodeManifestRegistry === undefined ? undefined : createNodeContextResolver(nodeManifestRegistry);
  const allowedOrigins = nodeManifestRegistry === undefined
    ? options.allowedOrigins
    : expandRuntimeOrigins(options.allowedOrigins, nodeManifestRegistry, options.allowedOriginSurfaces ?? []);
  return Object.freeze({ app: new HttpApp(routes, allowedOrigins, undefined, undefined, new OperationMetrics(options.telemetry),
    options.gateEngine, nodeContextResolver, arch),
    modules: modules.catalog(), routes, arch, nodeContextResolver });
}

function expandRuntimeOrigins(
  origins: readonly string[],
  registry: NodeManifestRegistry,
  declaredSurfaces: readonly string[],
): readonly string[] {
  const surfaces = new Set([...declaredSurfaces, ...registry.manifests.flatMap((manifest) => manifest.domain_bindings
    .filter((binding) => origins.includes(`https://${binding.host}`))
    .map((binding) => binding.surface_ref))]);
  if (surfaces.size === 0) return origins;
  return Object.freeze([...new Set([...origins, ...registry.manifests.flatMap((manifest) => manifest.domain_bindings
    .filter((binding) => surfaces.has(binding.surface_ref))
    .map((binding) => `https://${binding.host}`))])]);
}
