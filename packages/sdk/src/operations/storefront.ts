// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const STOREFRONT_OPERATION_IDS = Object.freeze([
  "storefront.bootstrap.read",
  "storefront.catalog.read",
] as const satisfies readonly OperationId[]);

export interface StorefrontOperations {
  readonly bootstrapRead: OperationMethod<"storefront.bootstrap.read">;
  readonly catalogRead: OperationMethod<"storefront.catalog.read">;
}

export const STOREFRONT_METHOD_BY_OPERATION = Object.freeze({
  "storefront.bootstrap.read": "bootstrapRead",
  "storefront.catalog.read": "catalogRead",
} as const satisfies Readonly<Record<(typeof STOREFRONT_OPERATION_IDS)[number], keyof StorefrontOperations>>);

export function createFetchStorefront(baseUrl: string): StorefrontOperations { return createStorefrontOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createStorefrontOperations(client: OperationExecutor): StorefrontOperations { return Object.freeze({
    bootstrapRead: bindBootstrapRead(client),
    catalogRead: bindCatalogRead(client),
  }); }

export function createFetchStorefrontBootstrapRead(baseUrl: string): OperationMethod<"storefront.bootstrap.read"> { return bindBootstrapRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindBootstrapRead(client: OperationExecutor): OperationMethod<"storefront.bootstrap.read"> { return bindOperation(client, defineOperation({ ...{"id":"storefront.bootstrap.read","method":"GET","path":"/api/v1/storefront/bootstrap","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","MEMBERSHIP_INACTIVE","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STOREFRONT_DISABLED","STOREFRONT_HANDLE_INVALID","STOREFRONT_MEMBERSHIP_MALL_MISMATCH","STOREFRONT_NOT_FOUND","STOREFRONT_NOT_PUBLISHED","STOREFRONT_PUBLICATION_UNAVAILABLE","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("StorefrontBootstrapReadInput", [] as const, false), output: exactOperationOutput("StorefrontBootstrapReadOutput") })); }

export function createFetchStorefrontCatalogRead(baseUrl: string): OperationMethod<"storefront.catalog.read"> { return bindCatalogRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindCatalogRead(client: OperationExecutor): OperationMethod<"storefront.catalog.read"> { return bindOperation(client, defineOperation({ ...{"id":"storefront.catalog.read","method":"GET","path":"/api/v1/storefront/catalog","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","MEMBERSHIP_INACTIVE","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STOREFRONT_DISABLED","STOREFRONT_HANDLE_INVALID","STOREFRONT_MEMBERSHIP_MALL_MISMATCH","STOREFRONT_NOT_FOUND","STOREFRONT_NOT_PUBLISHED","STOREFRONT_PUBLICATION_UNAVAILABLE","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("StorefrontCatalogReadInput", [] as const, false), output: exactOperationOutput("StorefrontCatalogReadOutput") })); }
