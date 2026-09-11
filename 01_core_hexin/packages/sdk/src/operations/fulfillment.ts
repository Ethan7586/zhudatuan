// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const FULFILLMENT_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "fulfillment.shipments.create",
  "fulfillment.tracking.read",
  "fulfillment.returns.receive",
  "fulfillment.returns.inspect",
] as const satisfies readonly OperationId[]);

export interface FulfillmentOperations {
  readonly shipmentsCreate: OperationMethod<"fulfillment.shipments.create">;
  readonly trackingRead: OperationMethod<"fulfillment.tracking.read">;
  readonly returnsReceive: OperationMethod<"fulfillment.returns.receive">;
  readonly returnsInspect: OperationMethod<"fulfillment.returns.inspect">;
}

export function createFetchFulfillment(baseUrl: string): FulfillmentOperations {
  return createFulfillmentOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createFulfillmentOperations(client: OperationExecutor): FulfillmentOperations {
  return Object.freeze({
    shipmentsCreate: bindShipmentsCreate(client),
    trackingRead: bindTrackingRead(client),
    returnsReceive: bindReturnsReceive(client),
    returnsInspect: bindReturnsInspect(client),
  });
}

export function createFetchFulfillmentShipmentsCreate(baseUrl: string): OperationMethod<"fulfillment.shipments.create"> {
  return bindShipmentsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindShipmentsCreate(client: OperationExecutor): OperationMethod<"fulfillment.shipments.create"> {
  return bindOperation(client, defineContractOperation({"id":"fulfillment.shipments.create","method":"POST","path":"/api/v1/fulfillments/{fulfillmentid}/shipments","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchFulfillmentTrackingRead(baseUrl: string): OperationMethod<"fulfillment.tracking.read"> {
  return bindTrackingRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTrackingRead(client: OperationExecutor): OperationMethod<"fulfillment.tracking.read"> {
  return bindOperation(client, defineContractOperation({"id":"fulfillment.tracking.read","method":"GET","path":"/api/v1/fulfillments/tracking","audience":"member","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchFulfillmentReturnsReceive(baseUrl: string): OperationMethod<"fulfillment.returns.receive"> {
  return bindReturnsReceive(new ApiClient(baseUrl, new FetchTransport()));
}

function bindReturnsReceive(client: OperationExecutor): OperationMethod<"fulfillment.returns.receive"> {
  return bindOperation(client, defineContractOperation({"id":"fulfillment.returns.receive","method":"PUT","path":"/api/v1/fulfillments/returns/{returnid}/receipt","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchFulfillmentReturnsInspect(baseUrl: string): OperationMethod<"fulfillment.returns.inspect"> {
  return bindReturnsInspect(new ApiClient(baseUrl, new FetchTransport()));
}

function bindReturnsInspect(client: OperationExecutor): OperationMethod<"fulfillment.returns.inspect"> {
  return bindOperation(client, defineContractOperation({"id":"fulfillment.returns.inspect","method":"PUT","path":"/api/v1/fulfillments/returns/{returnid}/inspection","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}
