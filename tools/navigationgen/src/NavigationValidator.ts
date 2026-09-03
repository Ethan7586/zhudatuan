import type { NavigationDocument, NavigationNode, RouteDefinition } from './NavigationSchema';

export interface OperationReference {
  readonly id: string;
  readonly permission: string | null;
  readonly capability: string;
  readonly requirements: readonly string[];
}

export interface ValidatedNavigation {
  readonly routes: readonly RouteDefinition[];
  readonly nodes: readonly NavigationNode[];
}

export function validateNavigation(document: NavigationDocument, operations: readonly OperationReference[]): ValidatedNavigation {
  if (document.routes.length === 0 || document.routes.length > 150) throw new Error(`ROUTE_COUNT_INVALID:${document.routes.length}`);
  if (document.nodes.length === 0 || document.nodes.length > 100) throw new Error(`NAVIGATION_NODE_COUNT_INVALID:${document.nodes.length}`);
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
  const byId = new Map<string, NavigationNode>();
  const nodeKeys = new Set<string>();
  for (const node of document.nodes) {
    if (byId.has(node.id)) throw new Error(`NAVIGATION_ID_DUPLICATE:${node.id}`);
    byId.set(node.id, node);
    const nodeKey = `${node.surface}:${node.scope}:${node.routeid}`;
    if (nodeKeys.has(nodeKey)) throw new Error(`NAVIGATION_ROUTE_DUPLICATE:${nodeKey}`);
    nodeKeys.add(nodeKey);
    const route = routeById.get(node.routeid);
    if (route === undefined) throw new Error(`NAVIGATION_ROUTE_UNKNOWN:${node.id}:${node.routeid}`);
    if (route.surface !== node.surface) throw new Error(`NAVIGATION_ROUTE_SURFACE_INVALID:${node.id}`);
    if (node.requirements.some((requirement) => !route.requirements.includes(requirement))) throw new Error(`NAVIGATION_ROUTE_REQUIREMENT_DRIFT:${node.id}`);
    const operation = operationById.get(node.entry);
    if (operation === undefined) throw new Error(`NAVIGATION_ENTRY_UNKNOWN:${node.id}:${node.entry}`);
    if (operation.permission !== null && !node.permissions.includes(operation.permission)) throw new Error(`NAVIGATION_ENTRY_PERMISSION_MISSING:${node.id}`);
    if (!node.capabilities.includes(operation.capability)) throw new Error(`NAVIGATION_ENTRY_CAPABILITY_MISSING:${node.id}`);
    for (const requirement of node.requirements) {
      if (!operation.requirements.includes(requirement) && !storefrontAggregate(node.id)) throw new Error(`NAVIGATION_ENTRY_REQUIREMENT_DRIFT:${node.id}:${requirement}`);
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
  const orphaned = routable.filter((route) => !referenced.has(route.id) && !isNestedRoute(route, routable, referenced));
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
  return id === 'storehome' || id === 'storeprofile';
}

function isNestedRoute(route: RouteDefinition, routes: readonly RouteDefinition[], referenced: ReadonlySet<string>): boolean {
  const routeSuffix = route.path.replace('/scopes/:scopeKind/:scopeId', '');
  if (/:[A-Za-z]/.test(routeSuffix)) return true;
  return routes.some((parent) => parent.surface === route.surface && referenced.has(parent.id) && parent.id !== route.id && route.path.startsWith(`${parent.path}/`));
}
