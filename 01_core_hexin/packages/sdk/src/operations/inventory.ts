// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const INVENTORY_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "inventory.availability.read",
  "inventory.imports.create",
  "inventory.imports.read",
] as const satisfies readonly OperationId[]);

export interface InventoryOperations {
  readonly availabilityRead: OperationMethod<"inventory.availability.read">;
  readonly importsCreate: OperationMethod<"inventory.imports.create">;
  readonly importsRead: OperationMethod<"inventory.imports.read">;
}

export function createFetchInventory(baseUrl: string): InventoryOperations {
  return createInventoryOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createInventoryOperations(client: OperationExecutor): InventoryOperations {
  return Object.freeze({
    availabilityRead: bindAvailabilityRead(client),
    importsCreate: bindImportsCreate(client),
    importsRead: bindImportsRead(client),
  });
}

export function createFetchInventoryAvailabilityRead(baseUrl: string): OperationMethod<"inventory.availability.read"> {
  return bindAvailabilityRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAvailabilityRead(client: OperationExecutor): OperationMethod<"inventory.availability.read"> {
  return bindOperation(client, defineContractOperation({"id":"inventory.availability.read","method":"GET","path":"/api/v1/inventory/availability","audience":"member","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchInventoryImportsCreate(baseUrl: string): OperationMethod<"inventory.imports.create"> {
  return bindImportsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindImportsCreate(client: OperationExecutor): OperationMethod<"inventory.imports.create"> {
  return bindOperation(client, defineContractOperation({"id":"inventory.imports.create","method":"POST","path":"/api/v1/inventory/imports","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchInventoryImportsRead(baseUrl: string): OperationMethod<"inventory.imports.read"> {
  return bindImportsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindImportsRead(client: OperationExecutor): OperationMethod<"inventory.imports.read"> {
  return bindOperation(client, defineContractOperation({"id":"inventory.imports.read","method":"GET","path":"/api/v1/inventory/imports","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}
