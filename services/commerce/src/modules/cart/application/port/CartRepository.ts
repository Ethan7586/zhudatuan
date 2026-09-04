import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { Cart, CartOwner } from '../../domain/model/Cart';
import type { CartLineMutation } from '../../domain/model/CartLine';

export type CartMergeState =
  | Readonly<{ state: 'none' }>
  | Readonly<{ state: 'completed' }>
  | Readonly<{ state: 'ready'; source: Cart; target: Cart }>;

export interface CartRepository {
  current(context: ReadTransactionContext, owner: CartOwner): Promise<Cart | null>;
  lockOrCreate(context: WriteTransactionContext, owner: CartOwner, expectedVersion: number): Promise<Cart>;
  lockExisting(context: WriteTransactionContext, owner: CartOwner, expectedVersion: number): Promise<Cart>;
  mutate(context: WriteTransactionContext, cart: Cart, changes: readonly CartLineMutation[]): Promise<Cart>;
  snapshot(context: ReadTransactionContext, cart: string): Promise<Cart>;
  prepareMerge(context: WriteTransactionContext, tokenDigest: string, owner: Extract<CartOwner, { kind: 'member' }>): Promise<CartMergeState>;
  completeMerge(context: WriteTransactionContext, source: Cart, target: Cart, changes: readonly CartLineMutation[]): Promise<Cart>;
}
