export const CANONICAL_STOREFRONT_AUTH_ORIGIN = 'https://accounts.zhudatuan.com';
export const LOCAL_STOREFRONT_AUTH_ORIGIN = 'http://127.0.0.1:3002';
export const DEFAULT_STOREFRONT_APPLICATION = 'zdt-l1-verify';

const LOCAL_AUTH_ORIGINS = new Set([LOCAL_STOREFRONT_AUTH_ORIGIN, 'http://localhost:3002']);

/**
 * Resolve the consumer sign-in origin without allowing an environment value
 * to turn the production storefront into an open redirect.
 */
export function resolveStorefrontAuthOrigin(candidate: string | undefined, environment: string | undefined): string {
  if (environment === 'production') {
    return CANONICAL_STOREFRONT_AUTH_ORIGIN;
  }
  if (candidate === CANONICAL_STOREFRONT_AUTH_ORIGIN || (candidate && LOCAL_AUTH_ORIGINS.has(candidate))) return candidate;
  return LOCAL_STOREFRONT_AUTH_ORIGIN;
}

export function storefrontAuthHref(surface: StorefrontSurface = runtimeStorefrontSurface()): string {
  const target = new URL('/', resolveStorefrontAuthOrigin(process.env.NEXT_PUBLIC_AUTH_ORIGIN, process.env.NODE_ENV));
  target.searchParams.set('target', 'storefront');
  target.searchParams.set('surface', surface);
  return target.toString();
}

function runtimeStorefrontSurface(): StorefrontSurface {
  if (typeof window === 'undefined') return 'web';
  return window.location.hostname === 'h5.zhudatuan.com' || window.location.pathname === '/h5' ? 'h5' : 'web';
}
