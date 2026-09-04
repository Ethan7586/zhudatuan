// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const FULFILLMENT_OPERATION_IDS = Object.freeze([
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

export const FULFILLMENT_METHOD_BY_OPERATION = Object.freeze({
  "fulfillment.shipments.create": "shipmentsCreate",
  "fulfillment.tracking.read": "trackingRead",
  "fulfillment.returns.receive": "returnsReceive",
  "fulfillment.returns.inspect": "returnsInspect",
} as const satisfies Readonly<Record<(typeof FULFILLMENT_OPERATION_IDS)[number], keyof FulfillmentOperations>>);

export function createFetchFulfillment(baseUrl: string): FulfillmentOperations { return createFulfillmentOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createFulfillmentOperations(client: OperationExecutor): FulfillmentOperations { return Object.freeze({
    shipmentsCreate: bindShipmentsCreate(client),
    trackingRead: bindTrackingRead(client),
    returnsReceive: bindReturnsReceive(client),
    returnsInspect: bindReturnsInspect(client),
  }); }

export function createFetchFulfillmentShipmentsCreate(baseUrl: string): OperationMethod<"fulfillment.shipments.create"> { return bindShipmentsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindShipmentsCreate(client: OperationExecutor): OperationMethod<"fulfillment.shipments.create"> { return bindOperation(client, defineOperation({ ...{"id":"fulfillment.shipments.create","method":"POST","path":"/api/v1/fulfillments/{fulfillmentid}/shipments","audience":"console","targets":["console","store","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FulfillmentShipmentsCreateInput", ["fulfillmentid"] as const, true), output: exactOperationOutput("FulfillmentShipmentsCreateOutput") })); }

export function createFetchFulfillmentTrackingRead(baseUrl: string): OperationMethod<"fulfillment.tracking.read"> { return bindTrackingRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindTrackingRead(client: OperationExecutor): OperationMethod<"fulfillment.tracking.read"> { return bindOperation(client, defineOperation({ ...{"id":"fulfillment.tracking.read","method":"GET","path":"/api/v1/fulfillments/tracking","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("FulfillmentTrackingReadInput", [] as const, false), output: exactOperationOutput("FulfillmentTrackingReadOutput") })); }

export function createFetchFulfillmentReturnsReceive(baseUrl: string): OperationMethod<"fulfillment.returns.receive"> { return bindReturnsReceive(new ApiClient(baseUrl, new FetchTransport())); }

function bindReturnsReceive(client: OperationExecutor): OperationMethod<"fulfillment.returns.receive"> { return bindOperation(client, defineOperation({ ...{"id":"fulfillment.returns.receive","method":"PUT","path":"/api/v1/fulfillments/returns/{returnid}/receipt","audience":"console","targets":["console","store","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("FulfillmentReturnsReceiveInput", ["returnid"] as const, true), output: exactOperationOutput("FulfillmentReturnsReceiveOutput") })); }

export function createFetchFulfillmentReturnsInspect(baseUrl: string): OperationMethod<"fulfillment.returns.inspect"> { return bindReturnsInspect(new ApiClient(baseUrl, new FetchTransport())); }

function bindReturnsInspect(client: OperationExecutor): OperationMethod<"fulfillment.returns.inspect"> { return bindOperation(client, defineOperation({ ...{"id":"fulfillment.returns.inspect","method":"PUT","path":"/api/v1/fulfillments/returns/{returnid}/inspection","audience":"console","targets":["console","store","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("FulfillmentReturnsInspectInput", ["returnid"] as const, true), output: exactOperationOutput("FulfillmentReturnsInspectOutput") })); }
