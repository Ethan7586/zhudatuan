const SHOWCASE_PATH_PREFIXES = ['/desktop-1920', '/mini-program', '/android-app', '/tablet-app', '/laptop-web'] as const;
const COMPATIBILITY_API_PATH_PREFIX = '/api/v1/';

const LOCAL_SHOWCASE_HOSTS = new Set(['127.0.0.1', 'localhost']);
export function isShowcasePath(pathname: string): boolean {
  return SHOWCASE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isLabsApiPathBlocked(hostname: string, pathname: string): boolean {
  return hostname.toLowerCase() === 'labs.zhudatuan.com' && (pathname === '/api/health' || pathname.startsWith(COMPATIBILITY_API_PATH_PREFIX));
}

export function isShowcaseHostAllowed(hostname: string, appEnvironment: string | undefined): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === 'labs.zhudatuan.com') return true;
  return appEnvironment !== 'production' && LOCAL_SHOWCASE_HOSTS.has(normalized);
}

export function isStorefrontRuntimeConfigurationAllowed(
  hostname: string,
  appEnvironment: string | undefined,
  authMode: string | undefined,
  registry: IdentityNodeRegistry = storefrontIdentityNodeRegistry(),
): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === 'labs.zhudatuan.com') return true;
  if (LOCAL_SHOWCASE_HOSTS.has(normalized)) return appEnvironment !== 'production';
  const productionHosts = new Set(registry.nodes.flatMap((node) => [
    ...node.storefrontHosts,
    node.accountsHost,
    new URL(node.adminOrigin).hostname,
  ]));
  if (productionHosts.has(normalized)) return appEnvironment === 'production' && authMode === 'membership';
  return false;
}
import type { IdentityNodeRegistry } from '@shop/sdk/identity-node';
import { storefrontIdentityNodeRegistry } from './storefrontIdentity';
