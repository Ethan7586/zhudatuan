import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CatalogPage, CatalogRows } from '../model/CatalogPage';
import type { ListingSnapshot } from '../../domain/model/Listing';

export interface ListingFilter {
  readonly scope: string;
  readonly scopeKind: string;
  readonly actorTarget: string;
  readonly query: string;
  readonly category: string;
  readonly product: string;
  readonly pool: string;
  readonly supplier: string;
  readonly mall: string;
  readonly status: string;
  readonly page: CatalogPage;
}

export interface ListingRepository {
  read(context: ReadTransactionContext, filter: ListingFilter): Promise<readonly Readonly<Record<string, unknown>>[]>;
  candidates(context: WriteTransactionContext, ids: readonly string[], scope: string): Promise<readonly ListingCandidate[]>;
  save(context: WriteTransactionContext, listings: readonly ListingSnapshot[]): Promise<readonly ListingRecord[]>;
}

export interface ListingPriceRepository {
  priceTarget(context: WriteTransactionContext, listing: string, scope: string): Promise<Readonly<{ listing: string; sku: string; scope: string }>>;
}

export interface ListingPoolRepository {
  changePool(context: WriteTransactionContext, listing: string, scope: string, pool: string | null, expectedVersion: number): Promise<ListingRecord>;
}

export interface ListingCandidate {
  readonly listing: ListingSnapshot;
  readonly product: string;
  readonly productState: string;
  readonly category: string;
  readonly partner: string | null;
  readonly regions: readonly string[];
  readonly skuState: string;
  readonly poolReady: boolean;
  readonly scopeReady: boolean;
  readonly channelReady: boolean;
}

export interface ListingRecord extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly scope_id: string;
  readonly pool_id: string | null;
  readonly sku_id: string;
  readonly title: string;
  readonly status: 'draft' | 'published' | 'unpublished' | 'retired';
  readonly version: number;
}
