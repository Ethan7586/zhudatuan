// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const ORDER_OPERATION_IDS = Object.freeze([
  "order.orders.create",
  "order.orders.read",
  "order.reminders.create",
  "order.orders.export",
  "order.aftersales.read",
  "order.aftersales.apply",
  "order.aftersales.approve",
  "order.aftersales.reject",
  "order.orders.receive",
] as const satisfies readonly OperationId[]);

export interface OrderOperations {
  readonly ordersCreate: OperationMethod<"order.orders.create">;
  readonly ordersRead: OperationMethod<"order.orders.read">;
  readonly remindersCreate: OperationMethod<"order.reminders.create">;
  readonly ordersExport: OperationMethod<"order.orders.export">;
  readonly aftersalesRead: OperationMethod<"order.aftersales.read">;
  readonly aftersalesApply: OperationMethod<"order.aftersales.apply">;
  readonly aftersalesApprove: OperationMethod<"order.aftersales.approve">;
  readonly aftersalesReject: OperationMethod<"order.aftersales.reject">;
  readonly ordersReceive: OperationMethod<"order.orders.receive">;
}

export function createFetchOrder(baseUrl: string): OrderOperations { return createOrderOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createOrderOperations(client: OperationExecutor): OrderOperations { return Object.freeze({
    ordersCreate: bindOrdersCreate(client),
    ordersRead: bindOrdersRead(client),
    remindersCreate: bindRemindersCreate(client),
    ordersExport: bindOrdersExport(client),
    aftersalesRead: bindAftersalesRead(client),
    aftersalesApply: bindAftersalesApply(client),
    aftersalesApprove: bindAftersalesApprove(client),
    aftersalesReject: bindAftersalesReject(client),
    ordersReceive: bindOrdersReceive(client),
  }); }

export function createFetchOrderOrdersCreate(baseUrl: string): OperationMethod<"order.orders.create"> { return bindOrdersCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindOrdersCreate(client: OperationExecutor): OperationMethod<"order.orders.create"> { return bindOperation(client, defineOperation({ ...{"id":"order.orders.create","method":"POST","path":"/api/v1/orders","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderOrdersCreateInput", [] as const, true), output: exactOperationOutput("OrderOrdersCreateOutput") })); }

export function createFetchOrderOrdersRead(baseUrl: string): OperationMethod<"order.orders.read"> { return bindOrdersRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindOrdersRead(client: OperationExecutor): OperationMethod<"order.orders.read"> { return bindOperation(client, defineOperation({ ...{"id":"order.orders.read","method":"GET","path":"/api/v1/orders","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderOrdersReadInput", [] as const, false), output: exactOperationOutput("OrderOrdersReadOutput") })); }

export function createFetchOrderRemindersCreate(baseUrl: string): OperationMethod<"order.reminders.create"> { return bindRemindersCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindRemindersCreate(client: OperationExecutor): OperationMethod<"order.reminders.create"> { return bindOperation(client, defineOperation({ ...{"id":"order.reminders.create","method":"POST","path":"/api/v1/orders/{orderid}/reminders","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderRemindersCreateInput", ["orderid"] as const, true), output: exactOperationOutput("OrderRemindersCreateOutput") })); }

export function createFetchOrderOrdersExport(baseUrl: string): OperationMethod<"order.orders.export"> { return bindOrdersExport(new ApiClient(baseUrl, new FetchTransport())); }

function bindOrdersExport(client: OperationExecutor): OperationMethod<"order.orders.export"> { return bindOperation(client, defineOperation({ ...{"id":"order.orders.export","method":"POST","path":"/api/v1/orders/exports","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderOrdersExportInput", [] as const, true), output: exactOperationOutput("OrderOrdersExportOutput") })); }

export function createFetchOrderAftersalesRead(baseUrl: string): OperationMethod<"order.aftersales.read"> { return bindAftersalesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindAftersalesRead(client: OperationExecutor): OperationMethod<"order.aftersales.read"> { return bindOperation(client, defineOperation({ ...{"id":"order.aftersales.read","method":"GET","path":"/api/v1/orders/aftersales","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderAftersalesReadInput", [] as const, false), output: exactOperationOutput("OrderAftersalesReadOutput") })); }

export function createFetchOrderAftersalesApply(baseUrl: string): OperationMethod<"order.aftersales.apply"> { return bindAftersalesApply(new ApiClient(baseUrl, new FetchTransport())); }

function bindAftersalesApply(client: OperationExecutor): OperationMethod<"order.aftersales.apply"> { return bindOperation(client, defineOperation({ ...{"id":"order.aftersales.apply","method":"POST","path":"/api/v1/orders/{orderid}/aftersales","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderAftersalesApplyInput", ["orderid"] as const, true), output: exactOperationOutput("OrderAftersalesApplyOutput") })); }

export function createFetchOrderAftersalesApprove(baseUrl: string): OperationMethod<"order.aftersales.approve"> { return bindAftersalesApprove(new ApiClient(baseUrl, new FetchTransport())); }

function bindAftersalesApprove(client: OperationExecutor): OperationMethod<"order.aftersales.approve"> { return bindOperation(client, defineOperation({ ...{"id":"order.aftersales.approve","method":"PUT","path":"/api/v1/orders/aftersales/{aftersaleid}/approval","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("OrderAftersalesApproveInput", ["aftersaleid"] as const, true), output: exactOperationOutput("OrderAftersalesApproveOutput") })); }

export function createFetchOrderAftersalesReject(baseUrl: string): OperationMethod<"order.aftersales.reject"> { return bindAftersalesReject(new ApiClient(baseUrl, new FetchTransport())); }

function bindAftersalesReject(client: OperationExecutor): OperationMethod<"order.aftersales.reject"> { return bindOperation(client, defineOperation({ ...{"id":"order.aftersales.reject","method":"DELETE","path":"/api/v1/orders/aftersales/{aftersaleid}/approval","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("OrderAftersalesRejectInput", ["aftersaleid"] as const, true), output: exactOperationOutput("OrderAftersalesRejectOutput") })); }

export function createFetchOrderOrdersReceive(baseUrl: string): OperationMethod<"order.orders.receive"> { return bindOrdersReceive(new ApiClient(baseUrl, new FetchTransport())); }

function bindOrdersReceive(client: OperationExecutor): OperationMethod<"order.orders.receive"> { return bindOperation(client, defineOperation({ ...{"id":"order.orders.receive","method":"POST","path":"/api/v1/orders/{orderid}/receive","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_RECEIPT_STATE_INVALID","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("OrderOrdersReceiveInput", ["orderid"] as const, true), output: exactOperationOutput("OrderOrdersReceiveOutput") })); }
