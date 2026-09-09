import { readStoredResource, writeStoredResource, type ResourceReadStorage, type ResourceWriteStorage } from '@shop/interaction';
import type { CartItem } from '../types';

const CART_CACHE_SCHEMA = 'storefront.cart-cache.v1';
const CART_CACHE_PREFIX = 'storefront:cart:';

interface CartCacheRecord {
  schema: typeof CART_CACHE_SCHEMA;
  items: CartItem[];
}

export function cartCacheScope(memberId: string, mallId: string): string {
  return `${memberId}:${mallId}`;
}

export function readCartCache(scope: string, storage: ResourceReadStorage | undefined = browserStorage()): CartItem[] {
  return readStoredResource(storage, `${CART_CACHE_PREFIX}${scope}`, decodeCart) ?? [];
}

export function writeCartCache(scope: string, items: CartItem[], storage: ResourceWriteStorage | undefined = browserStorage()): void {
  writeStoredResource(
    storage,
    `${CART_CACHE_PREFIX}${scope}`,
    items,
    (value): CartCacheRecord => ({
      schema: CART_CACHE_SCHEMA,
      items: value,
    })
  );
}

function browserStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function decodeCart(value: unknown): CartItem[] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Partial<CartCacheRecord>;
  if (record.schema !== CART_CACHE_SCHEMA || !Array.isArray(record.items)) return undefined;
  return record.items.filter(isCartItem);
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CartItem>;
  return typeof item.id === 'string' && typeof item.productId === 'string' && Number.isSafeInteger(item.quantity) && Number(item.quantity) > 0 && Boolean(item.product) && typeof item.product?.id === 'string';
}
