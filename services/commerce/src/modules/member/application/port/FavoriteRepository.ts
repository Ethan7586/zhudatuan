import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { FavoriteEntry, FavoriteState } from '../../domain/model/FavoriteList';

export interface FavoriteRepository {
  list(context: ReadTransactionContext, member: string, afterTime: string | null, afterListing: string | null, fetch: number): Promise<readonly FavoriteEntry[]>;
  change(context: WriteTransactionContext, member: string, listing: string, state: FavoriteState): Promise<FavoriteEntry>;
}
