import type { OperationInputFor } from '@shop/contract';

export type SearchOperation = 'voucher.search.read' | 'voucher.searchfacets.read' | 'voucher.searchsnapshots.create';
export type SearchInput = OperationInputFor<SearchOperation>;
export interface SearchFilter {
  readonly criteria: Readonly<Record<string, string>>;
  readonly query: string | null;
  readonly fingerprint: string | null;
}
