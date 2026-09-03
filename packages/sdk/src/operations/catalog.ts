// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

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

function bindPoolsRead(client: OperationExecutor): OperationMethod<"catalog.pools.read"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.pools.read","method":"GET","path":"/api/v1/catalog/pools","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("CatalogPoolsReadInput", [] as const, false), output: exactOperationOutput("CatalogPoolsReadOutput") })); }

export function createFetchCatalogPoolsAttach(baseUrl: string): OperationMethod<"catalog.pools.attach"> { return bindPoolsAttach(new ApiClient(baseUrl, new FetchTransport())); }

function bindPoolsAttach(client: OperationExecutor): OperationMethod<"catalog.pools.attach"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.pools.attach","method":"PUT","path":"/api/v1/catalog/pools/{poolid}/bindings/{scopeid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("CatalogPoolsAttachInput", ["poolid","scopeid"] as const, true), output: exactOperationOutput("CatalogPoolsAttachOutput") })); }

export function createFetchCatalogPoolsDetach(baseUrl: string): OperationMethod<"catalog.pools.detach"> { return bindPoolsDetach(new ApiClient(baseUrl, new FetchTransport())); }

function bindPoolsDetach(client: OperationExecutor): OperationMethod<"catalog.pools.detach"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.pools.detach","method":"DELETE","path":"/api/v1/catalog/pools/{poolid}/bindings/{scopeid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("CatalogPoolsDetachInput", ["poolid","scopeid"] as const, true), output: exactOperationOutput("CatalogPoolsDetachOutput") })); }

export function createFetchCatalogPoolsAllocate(baseUrl: string): OperationMethod<"catalog.pools.allocate"> { return bindPoolsAllocate(new ApiClient(baseUrl, new FetchTransport())); }

function bindPoolsAllocate(client: OperationExecutor): OperationMethod<"catalog.pools.allocate"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.pools.allocate","method":"POST","path":"/api/v1/catalog/pools/{poolid}/allocations","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("CatalogPoolsAllocateInput", ["poolid"] as const, true), output: exactOperationOutput("CatalogPoolsAllocateOutput") })); }

export function createFetchCatalogProductDetailRead(baseUrl: string): OperationMethod<"catalog.product.detail.read"> { return bindProductDetailRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindProductDetailRead(client: OperationExecutor): OperationMethod<"catalog.product.detail.read"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.product.detail.read","method":"GET","path":"/api/v1/catalog/products/{productid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("CatalogProductDetailReadInput", ["productid"] as const, false), output: exactOperationOutput("CatalogProductDetailReadOutput") })); }

export function createFetchCatalogProductsCreate(baseUrl: string): OperationMethod<"catalog.products.create"> { return bindProductsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindProductsCreate(client: OperationExecutor): OperationMethod<"catalog.products.create"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.products.create","method":"POST","path":"/api/v1/catalog/products","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("CatalogProductsCreateInput", [] as const, true), output: exactOperationOutput("CatalogProductsCreateOutput") })); }

export function createFetchCatalogProductsUpdate(baseUrl: string): OperationMethod<"catalog.products.update"> { return bindProductsUpdate(new ApiClient(baseUrl, new FetchTransport())); }

function bindProductsUpdate(client: OperationExecutor): OperationMethod<"catalog.products.update"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.products.update","method":"PATCH","path":"/api/v1/catalog/products/{productid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("CatalogProductsUpdateInput", ["productid"] as const, true), output: exactOperationOutput("CatalogProductsUpdateOutput") })); }

export function createFetchCatalogProductsArchive(baseUrl: string): OperationMethod<"catalog.products.archive"> { return bindProductsArchive(new ApiClient(baseUrl, new FetchTransport())); }

function bindProductsArchive(client: OperationExecutor): OperationMethod<"catalog.products.archive"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.products.archive","method":"DELETE","path":"/api/v1/catalog/products/{productid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("CatalogProductsArchiveInput", ["productid"] as const, true), output: exactOperationOutput("CatalogProductsArchiveOutput") })); }

export function createFetchCatalogListingsRead(baseUrl: string): OperationMethod<"catalog.listings.read"> { return bindListingsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindListingsRead(client: OperationExecutor): OperationMethod<"catalog.listings.read"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.listings.read","method":"GET","path":"/api/v1/catalog/listings","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("CatalogListingsReadInput", [] as const, false), output: exactOperationOutput("CatalogListingsReadOutput") })); }

export function createFetchCatalogListingsPublish(baseUrl: string): OperationMethod<"catalog.listings.publish"> { return bindListingsPublish(new ApiClient(baseUrl, new FetchTransport())); }

function bindListingsPublish(client: OperationExecutor): OperationMethod<"catalog.listings.publish"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.listings.publish","method":"PUT","path":"/api/v1/catalog/listings/{listingid}/publication","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("CatalogListingsPublishInput", ["listingid"] as const, true), output: exactOperationOutput("CatalogListingsPublishOutput") })); }

export function createFetchCatalogListingsUnpublish(baseUrl: string): OperationMethod<"catalog.listings.unpublish"> { return bindListingsUnpublish(new ApiClient(baseUrl, new FetchTransport())); }

function bindListingsUnpublish(client: OperationExecutor): OperationMethod<"catalog.listings.unpublish"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.listings.unpublish","method":"DELETE","path":"/api/v1/catalog/listings/{listingid}/publication","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("CatalogListingsUnpublishInput", ["listingid"] as const, true), output: exactOperationOutput("CatalogListingsUnpublishOutput") })); }

export function createFetchCatalogListingsBatch(baseUrl: string): OperationMethod<"catalog.listings.batch"> { return bindListingsBatch(new ApiClient(baseUrl, new FetchTransport())); }

function bindListingsBatch(client: OperationExecutor): OperationMethod<"catalog.listings.batch"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.listings.batch","method":"POST","path":"/api/v1/catalog/listings/batches","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("CatalogListingsBatchInput", [] as const, true), output: exactOperationOutput("CatalogListingsBatchOutput") })); }

export function createFetchCatalogImportsCreate(baseUrl: string): OperationMethod<"catalog.imports.create"> { return bindImportsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsCreate(client: OperationExecutor): OperationMethod<"catalog.imports.create"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.imports.create","method":"POST","path":"/api/v1/catalog/imports","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("CatalogImportsCreateInput", [] as const, true), output: exactOperationOutput("CatalogImportsCreateOutput") })); }

export function createFetchCatalogImportsRead(baseUrl: string): OperationMethod<"catalog.imports.read"> { return bindImportsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsRead(client: OperationExecutor): OperationMethod<"catalog.imports.read"> { return bindOperation(client, defineOperation({ ...{"id":"catalog.imports.read","method":"GET","path":"/api/v1/catalog/imports/{importid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("CatalogImportsReadInput", ["importid"] as const, false), output: exactOperationOutput("CatalogImportsReadOutput") })); }
