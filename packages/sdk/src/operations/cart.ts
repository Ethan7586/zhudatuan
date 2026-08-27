// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const CART_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "cart.current.read",
  "cart.items.put",
  "cart.items.batch",
] as const satisfies readonly OperationId[]);

export interface CartOperations {
  readonly currentRead: OperationMethod<"cart.current.read">;
  readonly itemsPut: OperationMethod<"cart.items.put">;
  readonly itemsBatch: OperationMethod<"cart.items.batch">;
}

export function createFetchCart(baseUrl: string): CartOperations {
  return createCartOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createCartOperations(client: OperationExecutor): CartOperations {
  return Object.freeze({
    currentRead: bindCurrentRead(client),
    itemsPut: bindItemsPut(client),
    itemsBatch: bindItemsBatch(client),
  });
}

export function createFetchCartCurrentRead(baseUrl: string): OperationMethod<"cart.current.read"> {
  return bindCurrentRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCurrentRead(client: OperationExecutor): OperationMethod<"cart.current.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"cart.current.read","method":"GET","path":"/api/v1/carts/current","audience":"member","idempotent":true,"pathKeys":[]}));
}

export function createFetchCartItemsPut(baseUrl: string): OperationMethod<"cart.items.put"> {
  return bindItemsPut(new ApiClient(baseUrl, new FetchTransport()));
}

function bindItemsPut(client: OperationExecutor): OperationMethod<"cart.items.put"> {
  return bindOperation(client, defineStructuralOperation({"id":"cart.items.put","method":"PUT","path":"/api/v1/carts/current/items/{listingid}","audience":"member","idempotent":true,"pathKeys":["listingid"]}));
}

export function createFetchCartItemsBatch(baseUrl: string): OperationMethod<"cart.items.batch"> {
  return bindItemsBatch(new ApiClient(baseUrl, new FetchTransport()));
}

function bindItemsBatch(client: OperationExecutor): OperationMethod<"cart.items.batch"> {
  return bindOperation(client, defineStructuralOperation({"id":"cart.items.batch","method":"POST","path":"/api/v1/carts/current/items/batches","audience":"member","idempotent":false,"pathKeys":[]}));
}
