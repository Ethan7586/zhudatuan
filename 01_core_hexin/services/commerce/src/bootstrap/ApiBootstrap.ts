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
import { ArchRuntimeState, configuredArchStatePath, readArchRuntimeState } from './ArchRuntimeState';

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
  readonly archStatePath?: string;
  readonly runtimeNodeIds?: readonly string[];
}

// L-ARCH-WIRING: live API assembly; modules and operation IDs are selected at startup.
// See L_ARCH_BOUNDARY.md. Business and access decisions remain in their existing owners.
export async function bootstrapApi(options: ApiBootstrapOptions): Promise<Readonly<{
  app: HttpApp;
  modules: readonly string[];
  routes: RouteRegistry;
  arch: ArchBoard;
  archState: ArchRuntimeState | undefined;
  nodeContextResolver: NodeContextResolver | undefined;
}>> {
  const container = new Container();
  await options.configure?.(container);
  const commands = new CommandBus();
  const queries = new QueryBus();
  const routes = new RouteRegistry(options.operationIds);
  const archStatePath = options.archStatePath ?? configuredArchStatePath();
  const initialArchState = archStatePath === undefined ? null : await readArchRuntimeState(archStatePath);
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
  const archOperations = routes.catalog()
    .map(({ operation }) => operation)
    .filter((operation) => !operation.startsWith('runtime.health.'));
  const archNodeIds = nodeManifestRegistry === undefined ? [] : nodeManifestRegistry.manifests
    .filter((candidate) => options.runtimeNodeIds === undefined || options.runtimeNodeIds.includes(candidate.node_id))
    .map((manifest) => manifest.node_id);
  const defaultArchNodeIds = [...archNodeIds, 'unresolved'];
  const archState = archStatePath === undefined ? undefined : new ArchRuntimeState(archStatePath, arch, initialArchState);
  if (archState === undefined) arch.mountAll(defaultArchNodeIds, archOperations);
  else archState.registerDefaults(defaultArchNodeIds, archOperations);
  archState?.start();
  container.freeze();
  const nodeContextResolver = nodeManifestRegistry === undefined ? undefined
    : restrictRuntimeNodes(createNodeContextResolver(nodeManifestRegistry), options.runtimeNodeIds);
  const allowedOrigins = nodeManifestRegistry === undefined
    ? options.allowedOrigins
    : expandRuntimeOrigins(options.allowedOrigins, nodeManifestRegistry, options.allowedOriginSurfaces ?? []);
  return Object.freeze({ app: new HttpApp(routes, allowedOrigins, undefined, undefined, new OperationMetrics(options.telemetry),
    options.gateEngine, nodeContextResolver, arch),
    modules: modules.catalog(), routes, arch, archState, nodeContextResolver });
}

function restrictRuntimeNodes(resolver: NodeContextResolver, nodeIds: readonly string[] | undefined): NodeContextResolver {
  if (nodeIds === undefined) return resolver;
  const allowed = new Set(nodeIds);
  return Object.freeze({
    registry: resolver.registry,
    resolve(host: string) {
      const context = resolver.resolve(host);
      if (!allowed.has(context.node_id)) throw new Error('SFL_NODE_MANIFEST_HOST_RUNTIME_MISMATCH');
      return context;
    },
  });
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
