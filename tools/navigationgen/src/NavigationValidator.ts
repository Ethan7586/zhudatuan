import type { NavigationDocument, NavigationNode, RouteDefinition } from './NavigationSchema';

export interface OperationReference {
  readonly id: string;
  readonly owner: string;
  readonly lifecycle: string;
  readonly permission: string | null;
  readonly capability: string;
  readonly requirements: readonly string[];
  readonly targets: readonly string[];
  readonly scopeKinds: readonly string[];
}

export interface ValidatedNavigation {
  readonly routes: readonly RouteDefinition[];
  readonly nodes: readonly NavigationNode[];
}

export interface NavigationCapacity {
  readonly maximumRoutes: number;
  readonly maximumNodes: number;
}

export function validateNavigation(document: NavigationDocument, operations: readonly OperationReference[], capacity: NavigationCapacity): ValidatedNavigation {
  if (!Number.isSafeInteger(capacity.maximumRoutes) || capacity.maximumRoutes < 1 || !Number.isSafeInteger(capacity.maximumNodes) || capacity.maximumNodes < 1) {
    throw new Error('NAVIGATION_CAPACITY_INVALID');
  }
  if (document.routes.length === 0) throw new Error('NAVIGATION_ROUTE_EMPTY');
  if (document.routes.length > capacity.maximumRoutes) throw new Error(`NAVIGATION_ROUTE_CAPACITY_EXCEEDED:${document.routes.length}:${capacity.maximumRoutes}`);
  if (document.nodes.length === 0) throw new Error('NAVIGATION_NODE_EMPTY');
  if (document.nodes.length > capacity.maximumNodes) throw new Error(`NAVIGATION_NODE_CAPACITY_EXCEEDED:${document.nodes.length}:${capacity.maximumNodes}`);
  const operationById = new Map(operations.map((operation) => [operation.id, operation]));
  const routeById = new Map<string, RouteDefinition>();
  const routePaths = new Set<string>();
  for (const route of document.routes) {
    if (routeById.has(route.id)) throw new Error(`ROUTE_ID_DUPLICATE:${route.id}`);
    routeById.set(route.id, route);
    const key = `${route.surface}:${route.path}`;
    if (routePaths.has(key)) throw new Error(`ROUTE_PATH_DUPLICATE:${key}`);
    routePaths.add(key);
  }
  for (const surface of ['auth', 'console', 'storefront', 'miniapp', 'store', 'supplier'] as const) {
    const routes = document.routes.filter((route) => route.surface === surface);
    if (routes.length === 0) throw new Error(`ROUTE_SURFACE_EMPTY:${surface}`);
    const defaults = routes.filter((route) => route.default).length;
    if (defaults !== 1) throw new Error(defaults === 0 ? `ROUTE_DEFAULT_MISSING:${surface}` : `ROUTE_DEFAULT_DUPLICATE:${surface}`);
  }
  const byId = new Map<string, NavigationNode>();
  const nodeKeys = new Set<string>();
  for (const node of document.nodes) {
    if (byId.has(node.id)) throw new Error(`NAVIGATION_ID_DUPLICATE:${node.id}`);
    if (!/\p{Script=Han}/u.test(node.title) || node.title.length > 80) throw new Error(`NAVIGATION_TITLE_INVALID:${node.id}`);
    byId.set(node.id, node);
    const nodeKey = `${node.surface}:${node.scope}:${node.routeid}`;
    if (nodeKeys.has(nodeKey)) throw new Error(`NAVIGATION_ROUTE_DUPLICATE:${nodeKey}`);
    nodeKeys.add(nodeKey);
    const route = routeById.get(node.routeid);
    if (route === undefined) throw new Error(`NAVIGATION_ROUTE_UNKNOWN:${node.id}:${node.routeid}`);
    if (route.surface !== node.surface) throw new Error(`NAVIGATION_ROUTE_SURFACE_INVALID:${node.id}`);
    const operation = operationById.get(node.entry);
    if (operation === undefined) throw new Error(`NAVIGATION_ENTRY_UNKNOWN:${node.id}:${node.entry}`);
    if (operation.lifecycle !== 'active') throw new Error(`NAVIGATION_ENTRY_INACTIVE:${node.id}:${node.entry}`);
    if (!operation.targets.includes(node.surface)) throw new Error(`NAVIGATION_ENTRY_SURFACE_DENIED:${node.id}:${node.entry}`);
    const consumerSelfScope = (node.surface === 'storefront' || node.surface === 'miniapp') && node.scope === 'mall' && (operation.scopeKinds.includes('owner') || operation.scopeKinds.includes('self'));
    if (!operation.scopeKinds.includes(node.scope) && !consumerSelfScope) throw new Error(`NAVIGATION_ENTRY_SCOPE_DENIED:${node.id}:${node.entry}`);
    if (!/^[a-z]+$/.test(operation.owner)) throw new Error(`NAVIGATION_ENTRY_OWNER_INVALID:${node.id}:${operation.owner}`);
    if (operation.permission !== null && !/^[a-z]+(?:\.[a-z]+)+$/.test(operation.permission)) throw new Error(`NAVIGATION_ENTRY_PERMISSION_INVALID:${node.id}`);
    if (!/^[a-z]+(?:\.[a-z]+)+$/.test(operation.capability)) throw new Error(`NAVIGATION_ENTRY_CAPABILITY_INVALID:${node.id}`);
    if (!route.requirements.some((requirement) => operation.requirements.includes(requirement)) && !storefrontAggregate(node.id)) {
      throw new Error(`NAVIGATION_ENTRY_REQUIREMENT_DRIFT:${node.id}`);
    }
  }
  for (const node of document.nodes) {
    if (node.parent === null) continue;
    const parent = byId.get(node.parent);
    if (parent === undefined) throw new Error(`NAVIGATION_PARENT_MISSING:${node.id}:${node.parent}`);
    if (parent.surface !== node.surface || parent.scope !== node.scope) throw new Error(`NAVIGATION_PARENT_BOUNDARY_INVALID:${node.id}`);
    visit(node, byId, new Set());
  }
  const referenced = new Set(document.nodes.map(({ routeid }) => routeid));
  const routable = document.routes.filter(({ surface }) => surface !== 'auth');
  const orphaned = routable.filter((route) => !referenced.has(route.id));
  if (orphaned.length > 0) throw new Error(`ROUTE_ORPHANED:${orphaned.map(({ id }) => id).join(',')}`);
  const routes = [...document.routes].sort((left, right) => left.surface.localeCompare(right.surface) || left.path.localeCompare(right.path) || left.id.localeCompare(right.id));
  const nodes = [...document.nodes].sort(
    (left, right) => left.surface.localeCompare(right.surface) || left.scope.localeCompare(right.scope) || (left.parent ?? '').localeCompare(right.parent ?? '') || left.order - right.order || left.id.localeCompare(right.id)
  );
  return Object.freeze({ routes: Object.freeze(routes), nodes: Object.freeze(nodes) });
}

function visit(node: NavigationNode, nodes: ReadonlyMap<string, NavigationNode>, visited: Set<string>): void {
  if (visited.has(node.id)) throw new Error(`NAVIGATION_CYCLE:${node.id}`);
  visited.add(node.id);
  if (node.parent !== null) visit(nodes.get(node.parent)!, nodes, visited);
  visited.delete(node.id);
}

function storefrontAggregate(id: string): boolean {
  return id === 'storehome' || id === 'storeprofile' || id === 'miniapphome' || id === 'miniappprofile';
}
