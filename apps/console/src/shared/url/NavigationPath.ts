interface NavigationRoute {
  readonly route: string;
}
interface NavigationScope {
  readonly kind: string;
  readonly id: string;
}
interface NavigationNode extends NavigationRoute {
  readonly component: string;
  readonly title: string;
  readonly disabled: boolean;
  readonly children: readonly NavigationNode[];
}

export function navigationPath(node: NavigationRoute, scope: NavigationScope): string {
  return node.route.replace(':scopeKind', encodeURIComponent(scope.kind)).replace(':scopeId', encodeURIComponent(scope.id));
}

export function flattenNavigation(nodes: readonly NavigationNode[]): readonly NavigationNode[] {
  return Object.freeze(nodes.flatMap((node) => [node, ...flattenNavigation(node.children)]));
}

export function flattenEnabledNavigation(nodes: readonly NavigationNode[]): readonly NavigationNode[] {
  return Object.freeze(nodes.flatMap((node) => (node.disabled ? [] : [node, ...flattenEnabledNavigation(node.children)])));
}
