import type { ScopeKind } from '@shop/authz';
import type { Listing, ListingPage, Pool, PoolPage, ProductDetail, ProductDraft, ProductReceipt } from '../model/Product';
import type { ProductFilter } from '../model/ProductFilter';

export interface ProductRequest {
  readonly scope: Readonly<{ kind: ScopeKind; id: string }>;
  readonly accessVersion: number;
  readonly csrf?: string;
}

export interface ProductQuery extends ProductFilter {
  readonly cursor?: string;
  readonly limit: number;
}

export interface ProductCommand extends ProductRequest {
  readonly identity: string;
}

export interface ProductPort {
  readProducts(request: ProductRequest, query: ProductQuery, signal: AbortSignal): Promise<ListingPage>;
  readProduct(request: ProductRequest, productid: string, signal?: AbortSignal): Promise<ProductDetail>;
  readPools(request: ProductRequest, signal: AbortSignal): Promise<PoolPage>;
  createProduct(request: ProductCommand, draft: ProductDraft): Promise<ProductReceipt>;
  updateProduct(request: ProductCommand, listing: Listing, draft: Readonly<{ title: string; category: string; status: string }>): Promise<ProductReceipt>;
  archiveProduct(request: ProductCommand, listing: Listing): Promise<ProductReceipt>;
  changePublication(request: ProductCommand, listings: readonly Listing[], published: boolean): Promise<ProductReceipt>;
  publishPrice(request: ProductCommand, listing: Listing, amountMinor: number): Promise<ProductReceipt>;
  allocatePool(request: ProductCommand, source: Pool, targetScope: string, kind: 'channel' | 'markup', name: string): Promise<ProductReceipt>;
  changePoolBinding(request: ProductCommand, pool: Pool, mallScope: string, attached: boolean): Promise<ProductReceipt>;
}
