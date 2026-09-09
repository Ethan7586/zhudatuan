import type { ApiCartItem } from '../services/productionApi.types';
import type { CartItem, Product } from '../types';
import { mapApiCartItems } from './mallMappers';

export function mergeAuthoritativeCart(items: ApiCartItem[], products: Product[], fallback: CartItem[]): CartItem[] {
  const mapped = mapApiCartItems(items, products);
  const mappedIds = new Set(mapped.map((item) => item.id));
  const fallbackById = new Map(fallback.map((item) => [item.id, item]));
  const recovered = items.flatMap((item) => {
    if (mappedIds.has(item.id)) return [];
    const previous = fallbackById.get(item.id);
    return previous ? [{ ...previous, quantity: item.quantity, selected: item.selected }] : [];
  });
  return [...mapped, ...recovered];
}
