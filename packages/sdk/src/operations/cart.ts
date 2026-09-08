// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInputFrom, exactOperationOutputFrom } from '@shop/contract/operationschema';
import { CART_QUERY_SCHEMAS, CART_BODY_SCHEMAS, CART_OUTPUT_SCHEMAS } from '@shop/contract/schema/Cart';
import { defineOperation } from '../CatalogOperationDescriptor';

export const CART_OPERATION_IDS = Object.freeze([
  "cart.current.read",
  "cart.anonymous.merge",
  "cart.items.put",
  "cart.items.batch",
] as const satisfies readonly OperationId[]);

export interface CartOperations {
  readonly currentRead: OperationMethod<"cart.current.read">;
  readonly anonymousMerge: OperationMethod<"cart.anonymous.merge">;
  readonly itemsPut: OperationMethod<"cart.items.put">;
  readonly itemsBatch: OperationMethod<"cart.items.batch">;
}

export const CART_METHOD_BY_OPERATION = Object.freeze({
  "cart.current.read": "currentRead",
  "cart.anonymous.merge": "anonymousMerge",
  "cart.items.put": "itemsPut",
  "cart.items.batch": "itemsBatch",
} as const satisfies Readonly<Record<(typeof CART_OPERATION_IDS)[number], keyof CartOperations>>);

export function createFetchCart(baseUrl: string): CartOperations { return createCartOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createCartOperations(client: OperationExecutor): CartOperations { return Object.freeze({
    currentRead: bindCurrentRead(client),
    anonymousMerge: bindAnonymousMerge(client),
    itemsPut: bindItemsPut(client),
    itemsBatch: bindItemsBatch(client),
  }); }

export function createFetchCartCurrentRead(baseUrl: string): OperationMethod<"cart.current.read"> { return bindCurrentRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindCurrentRead(client: OperationExecutor): OperationMethod<"cart.current.read"> { return bindOperation(client, defineOperation({ ...{"id":"cart.current.read","method":"GET","path":"/api/v1/carts/current","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CART_EMPTY","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","RISK_DENIED","RISK_REVIEW_REQUIRED","SCOPE_DENIED","STOREFRONT_DISABLED","STOREFRONT_HANDLE_INVALID","STOREFRONT_NOT_FOUND","STOREFRONT_NOT_PUBLISHED","STOREFRONT_PUBLICATION_UNAVAILABLE","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(CART_QUERY_SCHEMAS.CartCurrentReadInput, [] as const, false), output: exactOperationOutputFrom(CART_OUTPUT_SCHEMAS.CartCurrentReadOutput) })); }

export function createFetchCartAnonymousMerge(baseUrl: string): OperationMethod<"cart.anonymous.merge"> { return bindAnonymousMerge(new ApiClient(baseUrl, new FetchTransport())); }

export function bindAnonymousMerge(client: OperationExecutor): OperationMethod<"cart.anonymous.merge"> { return bindOperation(client, defineOperation({ ...{"id":"cart.anonymous.merge","method":"POST","path":"/api/v1/carts/current/merge","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(CART_BODY_SCHEMAS.CartMergeInput, [] as const, true), output: exactOperationOutputFrom(CART_OUTPUT_SCHEMAS.CartMergeOutput) })); }

export function createFetchCartItemsPut(baseUrl: string): OperationMethod<"cart.items.put"> { return bindItemsPut(new ApiClient(baseUrl, new FetchTransport())); }

export function bindItemsPut(client: OperationExecutor): OperationMethod<"cart.items.put"> { return bindOperation(client, defineOperation({ ...{"id":"cart.items.put","method":"PUT","path":"/api/v1/carts/current/items/{listingid}","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CART_EMPTY","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","LISTING_NOT_PURCHASABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RISK_DENIED","RISK_REVIEW_REQUIRED","SCOPE_DENIED","STOREFRONT_DISABLED","STOREFRONT_HANDLE_INVALID","STOREFRONT_NOT_FOUND","STOREFRONT_NOT_PUBLISHED","STOREFRONT_PUBLICATION_UNAVAILABLE","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(CART_BODY_SCHEMAS.CartItemsPutInput, ["listingid"] as const, true), output: exactOperationOutputFrom(CART_OUTPUT_SCHEMAS.CartItemsPutOutput) })); }

export function createFetchCartItemsBatch(baseUrl: string): OperationMethod<"cart.items.batch"> { return bindItemsBatch(new ApiClient(baseUrl, new FetchTransport())); }

export function bindItemsBatch(client: OperationExecutor): OperationMethod<"cart.items.batch"> { return bindOperation(client, defineOperation({ ...{"id":"cart.items.batch","method":"POST","path":"/api/v1/carts/current/items/batches","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CART_EMPTY","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RISK_DENIED","RISK_REVIEW_REQUIRED","SCOPE_DENIED","STOREFRONT_DISABLED","STOREFRONT_HANDLE_INVALID","STOREFRONT_NOT_FOUND","STOREFRONT_NOT_PUBLISHED","STOREFRONT_PUBLICATION_UNAVAILABLE","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(CART_BODY_SCHEMAS.CartItemsBatchInput, [] as const, true), output: exactOperationOutputFrom(CART_OUTPUT_SCHEMAS.CartItemsBatchOutput) })); }
