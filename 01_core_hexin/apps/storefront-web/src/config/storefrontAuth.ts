import { resolveStorefrontApplication } from './storefrontIdentity';

export const CANONICAL_STOREFRONT_AUTH_ORIGIN = 'https://accounts.hbbtzn.com';
export const LOCAL_STOREFRONT_AUTH_ORIGIN = 'http://127.0.0.1:3002';

const LOCAL_AUTH_ORIGINS = new Set([LOCAL_STOREFRONT_AUTH_ORIGIN, 'http://localhost:3002']);
const PRODUCTION_AUTH_ORIGINS = new Set([CANONICAL_STOREFRONT_AUTH_ORIGIN, 'https://accounts.zhudatuan.com']);

/**
 * Resolve the consumer sign-in origin without allowing an environment value
 * to turn the production storefront into an open redirect.
 */
export function resolveStorefrontAuthOrigin(candidate: string | undefined, environment: string | undefined): string {
  if (environment === 'production') {
    const selected = candidate?.trim() || CANONICAL_STOREFRONT_AUTH_ORIGIN;
    return PRODUCTION_AUTH_ORIGINS.has(selected) ? selected : CANONICAL_STOREFRONT_AUTH_ORIGIN;
  }
  if (candidate === CANONICAL_STOREFRONT_AUTH_ORIGIN || (candidate && LOCAL_AUTH_ORIGINS.has(candidate))) return candidate;
  return LOCAL_STOREFRONT_AUTH_ORIGIN;
}

export function storefrontAuthHref(hostname?: string): string {
  const target = new URL('/', resolveStorefrontAuthOrigin(process.env.NEXT_PUBLIC_AUTH_ORIGIN, process.env.NODE_ENV));
  target.searchParams.set('target', 'storefront');
  target.searchParams.set('surface', 'web');
  target.searchParams.set('application', resolveStorefrontApplication(hostname));
  return target.toString();
}
