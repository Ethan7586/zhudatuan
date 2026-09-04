// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const INVENTORY_OPERATION_IDS = Object.freeze([
  "inventory.availability.read",
  "inventory.imports.create",
  "inventory.imports.read",
] as const satisfies readonly OperationId[]);

export interface InventoryOperations {
  readonly availabilityRead: OperationMethod<"inventory.availability.read">;
  readonly importsCreate: OperationMethod<"inventory.imports.create">;
  readonly importsRead: OperationMethod<"inventory.imports.read">;
}

export const INVENTORY_METHOD_BY_OPERATION = Object.freeze({
  "inventory.availability.read": "availabilityRead",
  "inventory.imports.create": "importsCreate",
  "inventory.imports.read": "importsRead",
} as const satisfies Readonly<Record<(typeof INVENTORY_OPERATION_IDS)[number], keyof InventoryOperations>>);

export function createFetchInventory(baseUrl: string): InventoryOperations { return createInventoryOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createInventoryOperations(client: OperationExecutor): InventoryOperations { return Object.freeze({
    availabilityRead: bindAvailabilityRead(client),
    importsCreate: bindImportsCreate(client),
    importsRead: bindImportsRead(client),
  }); }

export function createFetchInventoryAvailabilityRead(baseUrl: string): OperationMethod<"inventory.availability.read"> { return bindAvailabilityRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindAvailabilityRead(client: OperationExecutor): OperationMethod<"inventory.availability.read"> { return bindOperation(client, defineOperation({ ...{"id":"inventory.availability.read","method":"GET","path":"/api/v1/inventory/availability","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","INVENTORY_BALANCE_INVALID","INVENTORY_INSUFFICIENT","INVENTORY_QUANTITY_INVALID","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("InventoryAvailabilityReadInput", [] as const, false), output: exactOperationOutput("InventoryAvailabilityReadOutput") })); }

export function createFetchInventoryImportsCreate(baseUrl: string): OperationMethod<"inventory.imports.create"> { return bindImportsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsCreate(client: OperationExecutor): OperationMethod<"inventory.imports.create"> { return bindOperation(client, defineOperation({ ...{"id":"inventory.imports.create","method":"POST","path":"/api/v1/inventory/imports","audience":"console","targets":["console","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","INVENTORY_BALANCE_INVALID","INVENTORY_INSUFFICIENT","INVENTORY_QUANTITY_INVALID","INVENTORY_RESERVATION_FINAL","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("InventoryImportsCreateInput", [] as const, true), output: exactOperationOutput("InventoryImportsCreateOutput") })); }

export function createFetchInventoryImportsRead(baseUrl: string): OperationMethod<"inventory.imports.read"> { return bindImportsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsRead(client: OperationExecutor): OperationMethod<"inventory.imports.read"> { return bindOperation(client, defineOperation({ ...{"id":"inventory.imports.read","method":"GET","path":"/api/v1/inventory/imports","audience":"console","targets":["console","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","INVENTORY_BALANCE_INVALID","INVENTORY_INSUFFICIENT","INVENTORY_QUANTITY_INVALID","INVENTORY_RESERVATION_FINAL","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("InventoryImportsReadInput", [] as const, false), output: exactOperationOutput("InventoryImportsReadOutput") })); }
