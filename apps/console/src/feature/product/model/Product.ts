import type { OperationBodyFor, OperationInputFor, OperationOutputFor } from '@shop/contract';

export type DeepReadonly<T> = T extends readonly (infer Item)[] ? readonly DeepReadonly<Item>[] : T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> } : T;
export type ListingPage = DeepReadonly<OperationOutputFor<'catalog.listings.read'>>;
export type Listing = ListingPage['items'][number];
export type PoolPage = DeepReadonly<OperationOutputFor<'catalog.pools.read'>>;
export type Pool = PoolPage['items'][number];
export type ProductDetail = DeepReadonly<OperationOutputFor<'catalog.product.detail.read'>>;
export type ProductDetailSection = NonNullable<OperationInputFor<'catalog.product.detail.read'>['query']>['section'];
export type ProductFacets = DeepReadonly<OperationOutputFor<'catalog.facets.read'>>;
export type ProductBatch = DeepReadonly<OperationOutputFor<'catalog.listings.batch'>>;
export type ProductBatchAction = NonNullable<OperationBodyFor<'CatalogListingsBatchInput'>['action']>;
export type ProductDraft = OperationBodyFor<'CatalogProductsCreateInput'>;
export type ProductImage = NonNullable<ProductDraft['image']>;
export type ProductImageProgress = Readonly<{ stage: 'checking' | 'uploading'; processed: number; total: number }>;
export type PoolAllocationKind = NonNullable<OperationBodyFor<'CatalogPoolsAllocateInput'>['kind']>;
