// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const CART_OPERATION_IDS = Object.freeze([
  "cart.current.read",
  "cart.items.put",
  "cart.items.batch",
] as const satisfies readonly OperationId[]);

export interface CartOperations {
  readonly currentRead: OperationMethod<"cart.current.read">;
  readonly itemsPut: OperationMethod<"cart.items.put">;
  readonly itemsBatch: OperationMethod<"cart.items.batch">;
}

export function createFetchCart(baseUrl: string): CartOperations { return createCartOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createCartOperations(client: OperationExecutor): CartOperations { return Object.freeze({
    currentRead: bindCurrentRead(client),
    itemsPut: bindItemsPut(client),
    itemsBatch: bindItemsBatch(client),
  }); }

export function createFetchCartCurrentRead(baseUrl: string): OperationMethod<"cart.current.read"> { return bindCurrentRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindCurrentRead(client: OperationExecutor): OperationMethod<"cart.current.read"> { return bindOperation(client, defineOperation({ ...{"id":"cart.current.read","method":"GET","path":"/api/v1/carts/current","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CART_EMPTY","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("CartCurrentReadInput", [] as const, false), output: exactOperationOutput("CartCurrentReadOutput") })); }

export function createFetchCartItemsPut(baseUrl: string): OperationMethod<"cart.items.put"> { return bindItemsPut(new ApiClient(baseUrl, new FetchTransport())); }

function bindItemsPut(client: OperationExecutor): OperationMethod<"cart.items.put"> { return bindOperation(client, defineOperation({ ...{"id":"cart.items.put","method":"PUT","path":"/api/v1/carts/current/items/{listingid}","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CART_EMPTY","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("CartItemsPutInput", ["listingid"] as const, true), output: exactOperationOutput("CartItemsPutOutput") })); }

export function createFetchCartItemsBatch(baseUrl: string): OperationMethod<"cart.items.batch"> { return bindItemsBatch(new ApiClient(baseUrl, new FetchTransport())); }

function bindItemsBatch(client: OperationExecutor): OperationMethod<"cart.items.batch"> { return bindOperation(client, defineOperation({ ...{"id":"cart.items.batch","method":"POST","path":"/api/v1/carts/current/items/batches","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CART_EMPTY","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("CartItemsBatchInput", [] as const, true), output: exactOperationOutput("CartItemsBatchOutput") })); }
