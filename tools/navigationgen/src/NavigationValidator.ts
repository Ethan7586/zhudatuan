import type { NavigationDocument, NavigationNode } from './NavigationSchema';

export interface OperationReference {
  readonly id: string;
  readonly permission: string | null;
  readonly capability: string;
  readonly requirements: readonly string[];
}

export function validateNavigation(document: NavigationDocument, operations: readonly OperationReference[]): readonly NavigationNode[] {
  if (document.nodes.length === 0 || document.nodes.length > 100) throw new Error(`NAVIGATION_NODE_COUNT_INVALID:${document.nodes.length}`);
  const operationById = new Map(operations.map((operation) => [operation.id, operation]));
  const byId = new Map<string, NavigationNode>();
  const routeKeys = new Set<string>();
  for (const node of document.nodes) {
    if (byId.has(node.id)) throw new Error(`NAVIGATION_ID_DUPLICATE:${node.id}`);
    byId.set(node.id, node);
    const routeKey = `${node.surface}:${node.scope}:${node.route}`;
    if (routeKeys.has(routeKey)) throw new Error(`NAVIGATION_ROUTE_DUPLICATE:${routeKey}`);
    routeKeys.add(routeKey);
    const operation = operationById.get(node.entry);
    if (operation === undefined) throw new Error(`NAVIGATION_ENTRY_UNKNOWN:${node.id}:${node.entry}`);
    if (operation.permission !== null && !node.permissions.includes(operation.permission)) throw new Error(`NAVIGATION_ENTRY_PERMISSION_MISSING:${node.id}`);
    if (!node.capabilities.includes(operation.capability)) throw new Error(`NAVIGATION_ENTRY_CAPABILITY_MISSING:${node.id}`);
    for (const requirement of node.requirements)
      if (!operation.requirements.includes(requirement) && !storefrontAggregate(node.id)) {
        throw new Error(`NAVIGATION_ENTRY_REQUIREMENT_DRIFT:${node.id}:${requirement}`);
      }
  }
  for (const node of document.nodes) {
    if (node.parent === null) continue;
    const parent = byId.get(node.parent);
    if (parent === undefined) throw new Error(`NAVIGATION_PARENT_MISSING:${node.id}:${node.parent}`);
    if (parent.surface !== node.surface || parent.scope !== node.scope) throw new Error(`NAVIGATION_PARENT_BOUNDARY_INVALID:${node.id}`);
    visit(node, byId, new Set());
  }
  const sorted = [...document.nodes].sort(
    (left, right) => left.surface.localeCompare(right.surface) || left.scope.localeCompare(right.scope) || (left.parent ?? '').localeCompare(right.parent ?? '') || left.order - right.order || left.id.localeCompare(right.id)
  );
  return Object.freeze(sorted);
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
