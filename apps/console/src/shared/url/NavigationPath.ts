import type { NavigationNode } from '../navigation/NavigationContract';

interface NavigationRoute {
  readonly route: string;
}
interface NavigationScope {
  readonly kind: string;
  readonly id: string;
}
export function navigationPath(node: NavigationRoute | NavigationNode, scope: NavigationScope): string {
  const route = 'experience' in node ? node.experience.route : node.route;
  return fillRouteTemplate(route, { scopeKind: scope.kind, scopeId: scope.id });
}

export function flattenNavigation(nodes: readonly NavigationNode[]): readonly NavigationNode[] {
  return Object.freeze(nodes.flatMap((node) => [node, ...flattenNavigation(node.children)]));
}

export function flattenEnabledNavigation(nodes: readonly NavigationNode[]): readonly NavigationNode[] {
  return Object.freeze(nodes.flatMap((node) => [...(node.experience.disabled ? [] : [node]), ...flattenEnabledNavigation(node.children)]));
}
import { fillRouteTemplate } from '../../generated/RouteBinding';
