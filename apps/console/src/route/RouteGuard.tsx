import { operationPolicy } from '@shop/contract/policies';
import { matchPath, redirect } from 'react-router';
import type { ConsoleNavigationNode, ConsoleScope } from '../entity/session/ConsoleSession';
import { ROUTE_BASE } from '../generated/RouteBinding';
import type { ComponentRouteBinding, RouteRegistryContract } from '../shared/manifest/ComponentManifest';
import { flattenEnabledNavigation, navigationPath } from '../shared/url/NavigationPath';
import { routeResponse } from './RouteResponse';

export interface NavigationSelection {
  readonly defaultKey: string;
  readonly nodes: readonly ConsoleNavigationNode[];
}

export interface RouteAccess {
  readonly capabilities: readonly string[];
  readonly permissions: readonly string[];
}

export function guardRoute(pathname: string, navigation: NavigationSelection, scope: ConsoleScope, access: RouteAccess, registry: RouteRegistryContract): Response | undefined {
  if (matchPath({ path: ROUTE_BASE, end: true }, pathname) !== null) return redirect(landingPath(navigation, scope, registry));
  const resolved = registry.resolve(pathname);
  if (resolved === undefined) throw routeResponse('RESOURCE_NOT_FOUND');
  const route = registry.routes().find((candidate) => candidate.route.routeid === resolved.routeid)?.route;
  if (route === undefined) throw routeResponse('RESOURCE_NOT_FOUND');
  const scoped = route.bindings.filter((binding) => binding.scope === scope.kind);
  if (scoped.length === 0) throw routeResponse('SCOPE_DENIED');
  const capable = scoped.filter((binding) => hasCapability(binding, access));
  if (capable.length === 0) throw routeResponse('CAPABILITY_DENIED');
  const allowed = capable.filter((binding) => hasPermission(binding, access));
  if (allowed.length === 0) throw routeResponse('PERMISSION_DENIED');
  const visible = flattenEnabledNavigation(navigation.nodes).some((node) => node.experience.routeKey === resolved.routeid);
  if (!visible) throw routeResponse('NAVIGATION_SCOPE_DENIED');
  return undefined;
}

export function landingPath(navigation: NavigationSelection, scope: ConsoleScope, registry: RouteRegistryContract): string {
  const node = flattenEnabledNavigation(navigation.nodes).find((candidate) => candidate.key === navigation.defaultKey);
  if (node === undefined || !registry.hasComponent(node.experience.component)) throw routeResponse('NAVIGATION_CATALOG_MISMATCH');
  const path = navigationPath(node, scope);
  const resolved = registry.resolve(path);
  const route = resolved === undefined ? undefined : registry.routes().find((candidate) => candidate.route.routeid === resolved.routeid)?.route;
  if (route === undefined || resolved?.routeid !== node.experience.routeKey || !route.bindings.some((binding) => binding.scope === scope.kind)) {
    throw routeResponse('NAVIGATION_CATALOG_MISMATCH');
  }
  return path;
}

function hasCapability(binding: ComponentRouteBinding, access: RouteAccess): boolean {
  return access.capabilities.includes(operationPolicy(binding.operation).capability);
}

function hasPermission(binding: ComponentRouteBinding, access: RouteAccess): boolean {
  const permission = operationPolicy(binding.operation).permission;
  return permission === null || access.permissions.includes(permission);
}
