import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CatalogPage, CatalogRows } from '../model/CatalogPage';

export interface ListingFilter {
  readonly scope: string;
  readonly scopeKind: string;
  readonly actorTarget: string;
  readonly query: string;
  readonly category: string;
  readonly product: string;
  readonly pool: string;
  readonly page: CatalogPage;
}

export interface ListingRepository {
  read(context: ReadTransactionContext, filter: ListingFilter): Promise<readonly Readonly<Record<string, unknown>>[]>;
  publish(context: WriteTransactionContext, id: string, scope: string, expectedVersion: number | null): Promise<Readonly<Record<string, unknown>>>;
  unpublish(context: WriteTransactionContext, id: string, scope: string, expectedVersion: number | null): Promise<Readonly<Record<string, unknown>>>;
  batch(context: WriteTransactionContext, scope: string, ids: readonly string[], state: 'published' | 'unpublished'): Promise<CatalogRows>;
}
