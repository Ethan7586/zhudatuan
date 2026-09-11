// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const ORGANIZATION_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "organization.layers.read",
  "organization.stores.read",
  "organization.stores.manage",
] as const satisfies readonly OperationId[]);

export interface OrganizationOperations {
  readonly layersRead: OperationMethod<"organization.layers.read">;
  readonly storesRead: OperationMethod<"organization.stores.read">;
  readonly storesManage: OperationMethod<"organization.stores.manage">;
}

export function createFetchOrganization(baseUrl: string): OrganizationOperations {
  return createOrganizationOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createOrganizationOperations(client: OperationExecutor): OrganizationOperations {
  return Object.freeze({
    layersRead: bindLayersRead(client),
    storesRead: bindStoresRead(client),
    storesManage: bindStoresManage(client),
  });
}

export function createFetchOrganizationLayersRead(baseUrl: string): OperationMethod<"organization.layers.read"> {
  return bindLayersRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindLayersRead(client: OperationExecutor): OperationMethod<"organization.layers.read"> {
  return bindOperation(client, defineContractOperation({"id":"organization.layers.read","method":"GET","path":"/api/v1/organizations/layers","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchOrganizationStoresRead(baseUrl: string): OperationMethod<"organization.stores.read"> {
  return bindStoresRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStoresRead(client: OperationExecutor): OperationMethod<"organization.stores.read"> {
  return bindOperation(client, defineContractOperation({"id":"organization.stores.read","method":"GET","path":"/api/v1/organizations/stores","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchOrganizationStoresManage(baseUrl: string): OperationMethod<"organization.stores.manage"> {
  return bindStoresManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStoresManage(client: OperationExecutor): OperationMethod<"organization.stores.manage"> {
  return bindOperation(client, defineContractOperation({"id":"organization.stores.manage","method":"PUT","path":"/api/v1/organizations/stores/{storeid}","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}
