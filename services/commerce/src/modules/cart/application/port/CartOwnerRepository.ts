import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface CartOwner {
  readonly member: string;
  readonly mall: string;
  readonly application: string | null;
}

export interface CartOwnerRepository {
  resolve(context: ReadTransactionContext, membership: string): Promise<CartOwner>;
}
