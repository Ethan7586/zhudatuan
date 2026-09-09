import type { ScopeKind } from '@shop/authz';
import type { OperationBodyFor, OperationOutputFor } from '@shop/contract';
import type { CategoryPage, Listing, ListingPage, Pool, PoolAllocationKind, PoolPage, ProductBatch, ProductBatchAction, ProductCategory, ProductDetail, ProductDetailSection, ProductFacets, ProductImage, ProductImageProgress } from '../model/Product';
import type { ProductFilter } from '../model/ProductFilter';

export type ProductRequest = Readonly<{
  readonly scope: Readonly<{ kind: ScopeKind; id: string }>;
  readonly accessVersion: number;
  readonly csrf?: string;
}>;

export type ProductQuery = Readonly<
  ProductFilter & {
    readonly cursor?: string;
    readonly limit: number;
  }
>;

export type ProductCommand = Readonly<
  ProductRequest & {
    readonly identity: string;
  }
>;

export interface ProductPort {
  readProducts(request: ProductRequest, query: ProductQuery, signal: AbortSignal): Promise<ListingPage>;
  readFacets(request: ProductRequest, query: Readonly<{ q: string }>, signal: AbortSignal): Promise<ProductFacets>;
  readProduct(request: ProductRequest, productid: string, section: ProductDetailSection, signal?: AbortSignal): Promise<ProductDetail>;
  readPools(request: ProductRequest, signal: AbortSignal): Promise<PoolPage>;
  readCategories(request: ProductRequest, signal: AbortSignal): Promise<CategoryPage>;
  createCategory(request: ProductCommand, body: Readonly<{ name: string; parent: string | null; sort: number }>): Promise<ProductCategory>;
  uploadProductImage(request: ProductCommand, file: File, signal?: AbortSignal, progress?: (value: ProductImageProgress) => void): Promise<ProductImage>;
  createProduct(request: ProductCommand, body: OperationBodyFor<'CatalogProductsCreateInput'>): Promise<OperationOutputFor<'catalog.products.create'>>;
  updateProduct(request: ProductCommand, listing: Listing, expectedVersion: number, body: OperationBodyFor<'CatalogProductsUpdateInput'>): Promise<OperationOutputFor<'catalog.products.update'>>;
  archiveProduct(request: ProductCommand, listing: Listing, expectedVersion: number): Promise<OperationOutputFor<'catalog.products.archive'>>;
  changePublication(request: ProductCommand, listings: readonly Listing[], published: boolean): Promise<OperationOutputFor<'catalog.listings.publish'>>;
  previewProductBatch(request: ProductCommand, listings: readonly Listing[], action: ProductBatchAction): Promise<ProductBatch>;
  executeProductBatch(request: ProductCommand, listings: readonly Listing[], action: ProductBatchAction, previewHash: string): Promise<ProductBatch>;
  publishPrice(request: ProductCommand, listing: Listing, amountMinor: number, expectedVersion: number): Promise<OperationOutputFor<'catalog.listings.price.set'>>;
  changeListingPool(request: ProductCommand, listing: Listing, pool: string | null): Promise<OperationOutputFor<'catalog.listings.pool.set'>>;
  allocatePool(request: ProductCommand, source: Pool, targetScope: string, kind: PoolAllocationKind, name: string): Promise<OperationOutputFor<'catalog.pools.allocate'>>;
  changePoolBinding(request: ProductCommand, pool: Pool, mallScope: string, attached: boolean): Promise<OperationOutputFor<'catalog.pools.attach'>>;
}
