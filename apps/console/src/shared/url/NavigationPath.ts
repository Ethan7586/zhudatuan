interface NavigationRoute {
  readonly route: string;
}
interface NavigationScope {
  readonly kind: string;
  readonly id: string;
}
interface NavigationNode {
  readonly key: string;
  readonly title: string;
  readonly experience: Readonly<{ route: string; routeKey: string; component: string; disabled: boolean; breadcrumbs: readonly Readonly<{ key: string; title: string }>[] }>;
  readonly children: readonly NavigationNode[];
}

export function navigationPath(node: NavigationRoute | NavigationNode, scope: NavigationScope): string {
  const route = 'experience' in node ? (node as NavigationNode).experience.route : node.route;
  return fillRouteTemplate(route, { scopeKind: scope.kind, scopeId: scope.id });
}

export function flattenNavigation(nodes: readonly NavigationNode[]): readonly NavigationNode[] {
  return Object.freeze(nodes.flatMap((node) => [node, ...flattenNavigation(node.children)]));
}

export function flattenEnabledNavigation(nodes: readonly NavigationNode[]): readonly NavigationNode[] {
  return Object.freeze(nodes.flatMap((node) => [...(node.experience.disabled ? [] : [node]), ...flattenEnabledNavigation(node.children)]));
}
import { fillRouteTemplate } from '../../generated/RouteBinding';
