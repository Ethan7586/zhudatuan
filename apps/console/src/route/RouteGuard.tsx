import { redirect } from 'react-router';
import type { ConsoleNavigationNode, ConsoleScope } from '../entity/session/ConsoleSession';
import type { RouteRegistryContract } from '../shared/manifest/ComponentManifest';
import { flattenEnabledNavigation, navigationPath } from '../shared/url/NavigationPath';

export function guardRoute(pathname: string, nodes: readonly ConsoleNavigationNode[], scope: ConsoleScope, registry: RouteRegistryContract): Response | undefined {
  const suffix = pathname.split('/').filter(Boolean).slice(3);
  if (suffix.length === 0) return redirect(landingPath(nodes, scope, registry));
  const manifest = registry.match(pathname);
  if (manifest === undefined) throw new Response('ROUTE_NOT_REGISTERED', { status: 404 });
  const visible = flattenEnabledNavigation(nodes).some((node) => node.component === manifest.component);
  return visible ? undefined : redirect(landingPath(nodes, scope, registry));
}

export function landingPath(nodes: readonly ConsoleNavigationNode[], scope: ConsoleScope, registry: RouteRegistryContract): string {
  const node = nodes.find((candidate) => !candidate.disabled && registry.hasComponent(candidate.component));
  if (node === undefined) throw new Response('NAVIGATION_EMPTY', { status: 403 });
  return navigationPath(node, scope);
}
