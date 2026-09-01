import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CartView } from '../../domain/model/Cart';
import type { CartLineMutation } from '../../domain/model/CartLine';

export interface CartRepository {
  current(context: ReadTransactionContext, member: string, mall: string, application: string): Promise<CartView | null>;
  lockOrCreate(context: WriteTransactionContext, member: string, mall: string, application: string, expectedVersion: number): Promise<string>;
  lockExisting(context: WriteTransactionContext, member: string, mall: string, application: string, expectedVersion: number): Promise<string>;
  lineVersions(context: WriteTransactionContext, cart: string, listings: readonly string[]): Promise<ReadonlyMap<string, number>>;
  mutate(context: WriteTransactionContext, cart: string, changes: readonly CartLineMutation[]): Promise<void>;
  snapshot(context: ReadTransactionContext, cart: string): Promise<CartView>;
}
