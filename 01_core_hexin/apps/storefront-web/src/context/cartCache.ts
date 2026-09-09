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

export function readCartCache(scope: string, storage: Pick<Storage, 'getItem'> = window.localStorage): CartItem[] {
  try {
    const raw = storage.getItem(`${CART_CACHE_PREFIX}${scope}`);
    if (!raw) return [];
    const value = JSON.parse(raw) as Partial<CartCacheRecord>;
    if (value.schema !== CART_CACHE_SCHEMA || !Array.isArray(value.items)) return [];
    return value.items.filter(isCartItem);
  } catch {
    return [];
  }
}

export function writeCartCache(scope: string, items: CartItem[], storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  try {
    const value: CartCacheRecord = { schema: CART_CACHE_SCHEMA, items };
    storage.setItem(`${CART_CACHE_PREFIX}${scope}`, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private WebViews. The in-memory cart stays authoritative for this visit.
  }
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CartItem>;
  return typeof item.id === 'string'
    && typeof item.productId === 'string'
    && Number.isSafeInteger(item.quantity)
    && Number(item.quantity) > 0
    && Boolean(item.product)
    && typeof item.product?.id === 'string';
}
