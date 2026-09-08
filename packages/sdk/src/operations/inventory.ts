// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInputFrom, exactOperationOutputFrom } from '@shop/contract/operationschema';
import { INVENTORY_QUERY_SCHEMAS, INVENTORY_BODY_SCHEMAS, INVENTORY_OUTPUT_SCHEMAS } from '@shop/contract/schema/Inventory';
import { defineOperation } from '../CatalogOperationDescriptor';

export const INVENTORY_OPERATION_IDS = Object.freeze([
  "inventory.availability.read",
  "inventory.adjustments.read",
  "inventory.adjustments.create",
  "inventory.imports.create",
  "inventory.imports.read",
] as const satisfies readonly OperationId[]);

export interface InventoryOperations {
  readonly availabilityRead: OperationMethod<"inventory.availability.read">;
  readonly adjustmentsRead: OperationMethod<"inventory.adjustments.read">;
  readonly adjustmentsCreate: OperationMethod<"inventory.adjustments.create">;
  readonly importsCreate: OperationMethod<"inventory.imports.create">;
  readonly importsRead: OperationMethod<"inventory.imports.read">;
}

export const INVENTORY_METHOD_BY_OPERATION = Object.freeze({
  "inventory.availability.read": "availabilityRead",
  "inventory.adjustments.read": "adjustmentsRead",
  "inventory.adjustments.create": "adjustmentsCreate",
  "inventory.imports.create": "importsCreate",
  "inventory.imports.read": "importsRead",
} as const satisfies Readonly<Record<(typeof INVENTORY_OPERATION_IDS)[number], keyof InventoryOperations>>);

export function createFetchInventory(baseUrl: string): InventoryOperations { return createInventoryOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createInventoryOperations(client: OperationExecutor): InventoryOperations { return Object.freeze({
    availabilityRead: bindAvailabilityRead(client),
    adjustmentsRead: bindAdjustmentsRead(client),
    adjustmentsCreate: bindAdjustmentsCreate(client),
    importsCreate: bindImportsCreate(client),
    importsRead: bindImportsRead(client),
  }); }

export function createFetchInventoryAvailabilityRead(baseUrl: string): OperationMethod<"inventory.availability.read"> { return bindAvailabilityRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindAvailabilityRead(client: OperationExecutor): OperationMethod<"inventory.availability.read"> { return bindOperation(client, defineOperation({ ...{"id":"inventory.availability.read","method":"GET","path":"/api/v1/inventory/availability","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","INVENTORY_BALANCE_INVALID","INVENTORY_INSUFFICIENT","INVENTORY_QUANTITY_INVALID","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(INVENTORY_QUERY_SCHEMAS.InventoryAvailabilityReadInput, [] as const, false), output: exactOperationOutputFrom(INVENTORY_OUTPUT_SCHEMAS.InventoryAvailabilityReadOutput) })); }

export function createFetchInventoryAdjustmentsRead(baseUrl: string): OperationMethod<"inventory.adjustments.read"> { return bindAdjustmentsRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindAdjustmentsRead(client: OperationExecutor): OperationMethod<"inventory.adjustments.read"> { return bindOperation(client, defineOperation({ ...{"id":"inventory.adjustments.read","method":"GET","path":"/api/v1/inventory/adjustments","audience":"console","targets":["console","store"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(INVENTORY_QUERY_SCHEMAS.InventoryAdjustmentsReadInput, [] as const, false), output: exactOperationOutputFrom(INVENTORY_OUTPUT_SCHEMAS.InventoryAdjustmentsReadOutput) })); }

export function createFetchInventoryAdjustmentsCreate(baseUrl: string): OperationMethod<"inventory.adjustments.create"> { return bindAdjustmentsCreate(new ApiClient(baseUrl, new FetchTransport())); }

export function bindAdjustmentsCreate(client: OperationExecutor): OperationMethod<"inventory.adjustments.create"> { return bindOperation(client, defineOperation({ ...{"id":"inventory.adjustments.create","method":"POST","path":"/api/v1/inventory/adjustments","audience":"console","targets":["console","store"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["APPROVAL_TEMPLATE_DISABLED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","INVENTORY_QUANTITY_INVALID","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(INVENTORY_BODY_SCHEMAS.InventoryAdjustmentsCreateInput, [] as const, true), output: exactOperationOutputFrom(INVENTORY_OUTPUT_SCHEMAS.InventoryAdjustmentsCreateOutput) })); }

export function createFetchInventoryImportsCreate(baseUrl: string): OperationMethod<"inventory.imports.create"> { return bindImportsCreate(new ApiClient(baseUrl, new FetchTransport())); }

export function bindImportsCreate(client: OperationExecutor): OperationMethod<"inventory.imports.create"> { return bindOperation(client, defineOperation({ ...{"id":"inventory.imports.create","method":"POST","path":"/api/v1/inventory/imports","audience":"console","targets":["console","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","INVENTORY_BALANCE_INVALID","INVENTORY_INSUFFICIENT","INVENTORY_QUANTITY_INVALID","INVENTORY_RESERVATION_FINAL","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(INVENTORY_BODY_SCHEMAS.InventoryImportsCreateInput, [] as const, true), output: exactOperationOutputFrom(INVENTORY_OUTPUT_SCHEMAS.InventoryImportsCreateOutput) })); }

export function createFetchInventoryImportsRead(baseUrl: string): OperationMethod<"inventory.imports.read"> { return bindImportsRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindImportsRead(client: OperationExecutor): OperationMethod<"inventory.imports.read"> { return bindOperation(client, defineOperation({ ...{"id":"inventory.imports.read","method":"GET","path":"/api/v1/inventory/imports","audience":"console","targets":["console","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","INVENTORY_BALANCE_INVALID","INVENTORY_INSUFFICIENT","INVENTORY_QUANTITY_INVALID","INVENTORY_RESERVATION_FINAL","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(INVENTORY_QUERY_SCHEMAS.InventoryImportsReadInput, [] as const, false), output: exactOperationOutputFrom(INVENTORY_OUTPUT_SCHEMAS.InventoryImportsReadOutput) })); }
