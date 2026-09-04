import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ReservationExpiryRepository {
  expire(context: WriteTransactionContext, owner: string | null, at: Date, limit: number): Promise<Readonly<{ expired: number; more: boolean }>>;
}
