import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ListingFacetFilter {
  readonly scope: string;
  readonly scopeKind: string;
  readonly query: string;
}

export interface ListingFacet {
  readonly value: string;
  readonly label: string | null;
  readonly count: number;
}

export interface ListingFacets {
  readonly categories: readonly ListingFacet[];
  readonly suppliers: readonly ListingFacet[];
  readonly malls: readonly ListingFacet[];
  readonly statuses: readonly ListingFacet[];
}

export interface ListingFacetRepository {
  facets(context: ReadTransactionContext, filter: ListingFacetFilter): Promise<ListingFacets>;
}
