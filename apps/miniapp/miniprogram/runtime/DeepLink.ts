import { matchRoutePath, type RouteMatch } from '../generated/RouteBinding';
import { miniappPagePath } from '../generated/PageBinding';

export function miniappDeepLink(pathname: string): string {
  const match = matchRoutePath(pathname);
  if (match === undefined) throw new Error('MINIAPP_DEEP_LINK_INVALID');
  return miniappPagePath(match.id, match.parameters as Readonly<Record<string, string>>);
}

export function routeFromOptions(options: Readonly<Record<string, string | undefined>>, fallback: RouteMatch): RouteMatch {
  const pathname = options.path;
  if (pathname === undefined) return fallback;
  const resolved = matchRoutePath(pathname);
  if (resolved === undefined || (options.route !== undefined && resolved.id !== options.route)) throw new Error('MINIAPP_DEEP_LINK_INVALID');
  return resolved;
}
