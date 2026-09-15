import type { Product } from '../types';
import type { SessionStatus } from './MallContext.types';

export type PendingCartAddition = Readonly<{
  productId: string;
  product: Product;
  quantity: number;
  selectedSpec: Readonly<Record<string, string>>;
}>;

export type CartSessionDecision = 'commit' | 'queue' | 'require-login';

export function cartSessionDecision(sessionStatus: SessionStatus, isShowcase: boolean): CartSessionDecision {
  if (isShowcase || sessionStatus === 'authenticated') return 'commit';
  return sessionStatus === 'checking' ? 'queue' : 'require-login';
}

export function queueCartAddition(current: PendingCartAddition | null, product: Product, quantity: number, selectedSpec: Readonly<Record<string, string>>): PendingCartAddition {
  if (
    current !== null
    && current.productId === product.id
    && current.quantity === quantity
    && sameSelectedSpec(current.selectedSpec, selectedSpec)
  ) return current;
  return Object.freeze({
    productId: product.id,
    product,
    quantity,
    selectedSpec: Object.freeze({ ...selectedSpec }),
  });
}

function sameSelectedSpec(left: Readonly<Record<string, string>>, right: Readonly<Record<string, string>>): boolean {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}
