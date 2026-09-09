import type { CartItem, Product } from '../types';

export interface CartMutation {
  items: CartItem[];
  item: CartItem;
  previousQuantity: number;
  quantity: number;
}

export function addCartItemOptimistically(
  current: CartItem[],
  product: Product,
  increment: number,
  selectedSpec: Record<string, string>,
): CartMutation {
  const existing = current.find((item) => item.product.id === product.id);
  const previousQuantity = existing?.quantity ?? 0;
  const quantity = previousQuantity + increment;
  const item: CartItem = existing
    ? { ...existing, product, quantity, selected: true, selectedSpec: Object.keys(selectedSpec).length > 0 ? selectedSpec : existing.selectedSpec }
    : { id: product.id, productId: product.id, product, quantity, selected: true, selectedSpec };
  return {
    item,
    items: existing ? current.map((candidate) => candidate.id === existing.id ? item : candidate) : [...current, item],
    previousQuantity,
    quantity,
  };
}

export function setCartQuantityOptimistically(current: CartItem[], cartItemId: string, quantity: number): CartMutation | null {
  const index = current.findIndex((item) => item.id === cartItemId);
  if (index < 0) return null;
  const existing = current[index]!;
  const nextItem = { ...existing, quantity };
  return {
    item: existing,
    items: quantity === 0 ? current.filter((item) => item.id !== cartItemId) : current.map((item) => item.id === cartItemId ? nextItem : item),
    previousQuantity: existing.quantity,
    quantity,
  };
}

export function rollbackCartQuantity(
  current: CartItem[],
  snapshot: CartItem | undefined,
  cartItemId: string,
  quantity: number,
): CartItem[] {
  if (quantity === 0) return current.filter((item) => item.id !== cartItemId);
  const existing = current.find((item) => item.id === cartItemId);
  if (existing) return current.map((item) => item.id === cartItemId ? { ...item, quantity } : item);
  if (!snapshot) return current;
  return [{ ...snapshot, quantity }, ...current];
}
