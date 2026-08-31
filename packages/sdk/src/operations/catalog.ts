// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const CATALOG_OPERATION_IDS = Object.freeze([
  "catalog.pools.read",
  "catalog.pools.attach",
  "catalog.pools.detach",
  "catalog.pools.allocate",
  "catalog.product.detail.read",
  "catalog.products.create",
  "catalog.products.update",
  "catalog.products.archive",
  "catalog.listings.read",
  "catalog.listings.publish",
  "catalog.listings.unpublish",
  "catalog.listings.batch",
  "catalog.imports.create",
  "catalog.imports.read",
] as const satisfies readonly OperationId[]);

export interface CatalogOperations {
  readonly poolsRead: OperationMethod<"catalog.pools.read">;
  readonly poolsAttach: OperationMethod<"catalog.pools.attach">;
  readonly poolsDetach: OperationMethod<"catalog.pools.detach">;
  readonly poolsAllocate: OperationMethod<"catalog.pools.allocate">;
  readonly productDetailRead: OperationMethod<"catalog.product.detail.read">;
  readonly productsCreate: OperationMethod<"catalog.products.create">;
  readonly productsUpdate: OperationMethod<"catalog.products.update">;
  readonly productsArchive: OperationMethod<"catalog.products.archive">;
  readonly listingsRead: OperationMethod<"catalog.listings.read">;
  readonly listingsPublish: OperationMethod<"catalog.listings.publish">;
  readonly listingsUnpublish: OperationMethod<"catalog.listings.unpublish">;
  readonly listingsBatch: OperationMethod<"catalog.listings.batch">;
  readonly importsCreate: OperationMethod<"catalog.imports.create">;
  readonly importsRead: OperationMethod<"catalog.imports.read">;
}

export function createFetchCatalog(baseUrl: string): CatalogOperations { return createCatalogOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createCatalogOperations(client: OperationExecutor): CatalogOperations { return Object.freeze({
    poolsRead: bindPoolsRead(client),
    poolsAttach: bindPoolsAttach(client),
    poolsDetach: bindPoolsDetach(client),
    poolsAllocate: bindPoolsAllocate(client),
    productDetailRead: bindProductDetailRead(client),
    productsCreate: bindProductsCreate(client),
    productsUpdate: bindProductsUpdate(client),
    productsArchive: bindProductsArchive(client),
    listingsRead: bindListingsRead(client),
    listingsPublish: bindListingsPublish(client),
    listingsUnpublish: bindListingsUnpublish(client),
    listingsBatch: bindListingsBatch(client),
    importsCreate: bindImportsCreate(client),
    importsRead: bindImportsRead(client),
  }); }

export function createFetchCatalogPoolsRead(baseUrl: string): OperationMethod<"catalog.pools.read"> { return bindPoolsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindPoolsRead(client: OperationExecutor): OperationMethod<"catalog.pools.read"> { return bindOperation(client, defineOperation({"id":"catalog.pools.read","method":"GET","path":"/api/v1/catalog/pools","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchCatalogPoolsAttach(baseUrl: string): OperationMethod<"catalog.pools.attach"> { return bindPoolsAttach(new ApiClient(baseUrl, new FetchTransport())); }

function bindPoolsAttach(client: OperationExecutor): OperationMethod<"catalog.pools.attach"> { return bindOperation(client, defineOperation({"id":"catalog.pools.attach","method":"PUT","path":"/api/v1/catalog/pools/{poolid}/bindings/{scopeid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchCatalogPoolsDetach(baseUrl: string): OperationMethod<"catalog.pools.detach"> { return bindPoolsDetach(new ApiClient(baseUrl, new FetchTransport())); }

function bindPoolsDetach(client: OperationExecutor): OperationMethod<"catalog.pools.detach"> { return bindOperation(client, defineOperation({"id":"catalog.pools.detach","method":"DELETE","path":"/api/v1/catalog/pools/{poolid}/bindings/{scopeid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchCatalogPoolsAllocate(baseUrl: string): OperationMethod<"catalog.pools.allocate"> { return bindPoolsAllocate(new ApiClient(baseUrl, new FetchTransport())); }

function bindPoolsAllocate(client: OperationExecutor): OperationMethod<"catalog.pools.allocate"> { return bindOperation(client, defineOperation({"id":"catalog.pools.allocate","method":"POST","path":"/api/v1/catalog/pools/{poolid}/allocations","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchCatalogProductDetailRead(baseUrl: string): OperationMethod<"catalog.product.detail.read"> { return bindProductDetailRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindProductDetailRead(client: OperationExecutor): OperationMethod<"catalog.product.detail.read"> { return bindOperation(client, defineOperation({"id":"catalog.product.detail.read","method":"GET","path":"/api/v1/catalog/products/{productid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchCatalogProductsCreate(baseUrl: string): OperationMethod<"catalog.products.create"> { return bindProductsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindProductsCreate(client: OperationExecutor): OperationMethod<"catalog.products.create"> { return bindOperation(client, defineOperation({"id":"catalog.products.create","method":"POST","path":"/api/v1/catalog/products","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchCatalogProductsUpdate(baseUrl: string): OperationMethod<"catalog.products.update"> { return bindProductsUpdate(new ApiClient(baseUrl, new FetchTransport())); }

function bindProductsUpdate(client: OperationExecutor): OperationMethod<"catalog.products.update"> { return bindOperation(client, defineOperation({"id":"catalog.products.update","method":"PATCH","path":"/api/v1/catalog/products/{productid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchCatalogProductsArchive(baseUrl: string): OperationMethod<"catalog.products.archive"> { return bindProductsArchive(new ApiClient(baseUrl, new FetchTransport())); }

function bindProductsArchive(client: OperationExecutor): OperationMethod<"catalog.products.archive"> { return bindOperation(client, defineOperation({"id":"catalog.products.archive","method":"DELETE","path":"/api/v1/catalog/products/{productid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchCatalogListingsRead(baseUrl: string): OperationMethod<"catalog.listings.read"> { return bindListingsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindListingsRead(client: OperationExecutor): OperationMethod<"catalog.listings.read"> { return bindOperation(client, defineOperation({"id":"catalog.listings.read","method":"GET","path":"/api/v1/catalog/listings","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchCatalogListingsPublish(baseUrl: string): OperationMethod<"catalog.listings.publish"> { return bindListingsPublish(new ApiClient(baseUrl, new FetchTransport())); }

function bindListingsPublish(client: OperationExecutor): OperationMethod<"catalog.listings.publish"> { return bindOperation(client, defineOperation({"id":"catalog.listings.publish","method":"PUT","path":"/api/v1/catalog/listings/{listingid}/publication","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchCatalogListingsUnpublish(baseUrl: string): OperationMethod<"catalog.listings.unpublish"> { return bindListingsUnpublish(new ApiClient(baseUrl, new FetchTransport())); }

function bindListingsUnpublish(client: OperationExecutor): OperationMethod<"catalog.listings.unpublish"> { return bindOperation(client, defineOperation({"id":"catalog.listings.unpublish","method":"DELETE","path":"/api/v1/catalog/listings/{listingid}/publication","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchCatalogListingsBatch(baseUrl: string): OperationMethod<"catalog.listings.batch"> { return bindListingsBatch(new ApiClient(baseUrl, new FetchTransport())); }

function bindListingsBatch(client: OperationExecutor): OperationMethod<"catalog.listings.batch"> { return bindOperation(client, defineOperation({"id":"catalog.listings.batch","method":"POST","path":"/api/v1/catalog/listings/batches","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchCatalogImportsCreate(baseUrl: string): OperationMethod<"catalog.imports.create"> { return bindImportsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsCreate(client: OperationExecutor): OperationMethod<"catalog.imports.create"> { return bindOperation(client, defineOperation({"id":"catalog.imports.create","method":"POST","path":"/api/v1/catalog/imports","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchCatalogImportsRead(baseUrl: string): OperationMethod<"catalog.imports.read"> { return bindImportsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsRead(client: OperationExecutor): OperationMethod<"catalog.imports.read"> { return bindOperation(client, defineOperation({"id":"catalog.imports.read","method":"GET","path":"/api/v1/catalog/imports/{importid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }
