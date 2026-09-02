// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, defineOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const INVENTORY_OPERATION_IDS = Object.freeze([
  "inventory.imports.create",
  "inventory.imports.read",
] as const satisfies readonly OperationId[]);

export interface InventoryOperations {
  readonly importsCreate: OperationMethod<"inventory.imports.create">;
  readonly importsRead: OperationMethod<"inventory.imports.read">;
}

export function createFetchInventory(baseUrl: string): InventoryOperations { return createInventoryOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createInventoryOperations(client: OperationExecutor): InventoryOperations { return Object.freeze({
    importsCreate: bindImportsCreate(client),
    importsRead: bindImportsRead(client),
  }); }

export function createFetchInventoryImportsCreate(baseUrl: string): OperationMethod<"inventory.imports.create"> { return bindImportsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsCreate(client: OperationExecutor): OperationMethod<"inventory.imports.create"> { return bindOperation(client, defineOperation({"id":"inventory.imports.create","method":"POST","path":"/api/v1/inventory/imports","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchInventoryImportsRead(baseUrl: string): OperationMethod<"inventory.imports.read"> { return bindImportsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsRead(client: OperationExecutor): OperationMethod<"inventory.imports.read"> { return bindOperation(client, defineOperation({"id":"inventory.imports.read","method":"GET","path":"/api/v1/inventory/imports","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }
