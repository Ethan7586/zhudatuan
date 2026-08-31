// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const STOREFRONT_OPERATION_IDS = Object.freeze([
  "storefront.bootstrap.read",
  "storefront.catalog.read",
] as const satisfies readonly OperationId[]);

export interface StorefrontOperations {
  readonly bootstrapRead: OperationMethod<"storefront.bootstrap.read">;
  readonly catalogRead: OperationMethod<"storefront.catalog.read">;
}

export function createFetchStorefront(baseUrl: string): StorefrontOperations { return createStorefrontOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createStorefrontOperations(client: OperationExecutor): StorefrontOperations { return Object.freeze({
    bootstrapRead: bindBootstrapRead(client),
    catalogRead: bindCatalogRead(client),
  }); }

export function createFetchStorefrontBootstrapRead(baseUrl: string): OperationMethod<"storefront.bootstrap.read"> { return bindBootstrapRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindBootstrapRead(client: OperationExecutor): OperationMethod<"storefront.bootstrap.read"> { return bindOperation(client, defineOperation({"id":"storefront.bootstrap.read","method":"GET","path":"/api/v1/storefront/bootstrap","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchStorefrontCatalogRead(baseUrl: string): OperationMethod<"storefront.catalog.read"> { return bindCatalogRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindCatalogRead(client: OperationExecutor): OperationMethod<"storefront.catalog.read"> { return bindOperation(client, defineOperation({"id":"storefront.catalog.read","method":"GET","path":"/api/v1/storefront/catalog","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }
