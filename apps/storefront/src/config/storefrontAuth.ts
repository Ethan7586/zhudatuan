import { storefrontClientEnvironment } from '@shop/config/client';

export function storefrontAuthHref(returnPath = `${window.location.pathname}${window.location.search}`): string {
  const path = safePath(returnPath);
  const target = new URL('/', storefrontClientEnvironment().authOrigin);
  target.searchParams.set('target', 'storefront');
  target.searchParams.set('returnpath', path);
  return target.toString();
}

function safePath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) throw new Error('STOREFRONT_RETURN_PATH_INVALID');
  const parsed = new URL(value, window.location.origin);
  if (parsed.origin !== window.location.origin || parsed.hash) throw new Error('STOREFRONT_RETURN_PATH_INVALID');
  return `${parsed.pathname}${parsed.search}`;
}
