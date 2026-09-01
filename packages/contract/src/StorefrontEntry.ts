export const STOREFRONT_HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{2,47}$/;
export const STOREFRONT_ENTRY_URL_PATTERN = /^(?:https:\/\/[^/?#]+|http:\/\/127\.0\.0\.1(?::\d+)?)\/s\/[a-z0-9][a-z0-9-]{2,47}$/;

const reservedHandles = new Set(['admin', 'api', 'assets', 'auth', 'console', 'health', 'login', 's', 'www']);

declare const storefrontHandleBrand: unique symbol;
export type StorefrontHandle = string & { readonly [storefrontHandleBrand]: true };

export function parseStorefrontHandle(value: unknown): StorefrontHandle {
  if (typeof value !== 'string' || !STOREFRONT_HANDLE_PATTERN.test(value) || reservedHandles.has(value)) throw new Error('STOREFRONT_HANDLE_INVALID');
  return value as StorefrontHandle;
}

export function storefrontEntryUrl(origin: string, entryPath: string, handle: StorefrontHandle): string {
  const base = new URL(origin);
  const local = base.protocol === 'http:' && base.hostname === '127.0.0.1';
  if ((!local && base.protocol !== 'https:') || base.username || base.password || base.pathname !== '/' || base.search || base.hash || entryPath !== '/s') throw new Error('STOREFRONT_ADDRESS_CONFIG_INVALID');
  return new URL(`${entryPath}/${handle}`, base).toString();
}

export function parseStorefrontEntryUrl(value: unknown, origin: string, entryPath: string, handle: StorefrontHandle): string {
  if (typeof value !== 'string' || value !== storefrontEntryUrl(origin, entryPath, handle)) throw new Error('STOREFRONT_ENTRY_URL_INVALID');
  return value;
}
