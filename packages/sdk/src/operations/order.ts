// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const ORDER_OPERATION_IDS = Object.freeze([
  "order.orders.create",
  "order.orders.cancel",
  "order.orders.read",
  "order.detail.read",
  "order.reminders.create",
  "order.orders.export",
  "order.imports.create",
  "order.imports.read",
  "order.aftersales.read",
  "order.aftersaleattachments.create",
  "order.aftersales.apply",
  "order.aftersales.approve",
  "order.aftersales.reject",
  "order.orders.receive",
] as const satisfies readonly OperationId[]);

export interface OrderOperations {
  readonly ordersCreate: OperationMethod<"order.orders.create">;
  readonly ordersCancel: OperationMethod<"order.orders.cancel">;
  readonly ordersRead: OperationMethod<"order.orders.read">;
  readonly detailRead: OperationMethod<"order.detail.read">;
  readonly remindersCreate: OperationMethod<"order.reminders.create">;
  readonly ordersExport: OperationMethod<"order.orders.export">;
  readonly importsCreate: OperationMethod<"order.imports.create">;
  readonly importsRead: OperationMethod<"order.imports.read">;
  readonly aftersalesRead: OperationMethod<"order.aftersales.read">;
  readonly aftersaleattachmentsCreate: OperationMethod<"order.aftersaleattachments.create">;
  readonly aftersalesApply: OperationMethod<"order.aftersales.apply">;
  readonly aftersalesApprove: OperationMethod<"order.aftersales.approve">;
  readonly aftersalesReject: OperationMethod<"order.aftersales.reject">;
  readonly ordersReceive: OperationMethod<"order.orders.receive">;
}

export const ORDER_METHOD_BY_OPERATION = Object.freeze({
  "order.orders.create": "ordersCreate",
  "order.orders.cancel": "ordersCancel",
  "order.orders.read": "ordersRead",
  "order.detail.read": "detailRead",
  "order.reminders.create": "remindersCreate",
  "order.orders.export": "ordersExport",
  "order.imports.create": "importsCreate",
  "order.imports.read": "importsRead",
  "order.aftersales.read": "aftersalesRead",
  "order.aftersaleattachments.create": "aftersaleattachmentsCreate",
  "order.aftersales.apply": "aftersalesApply",
  "order.aftersales.approve": "aftersalesApprove",
  "order.aftersales.reject": "aftersalesReject",
  "order.orders.receive": "ordersReceive",
} as const satisfies Readonly<Record<(typeof ORDER_OPERATION_IDS)[number], keyof OrderOperations>>);

export function createFetchOrder(baseUrl: string): OrderOperations { return createOrderOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createOrderOperations(client: OperationExecutor): OrderOperations { return Object.freeze({
    ordersCreate: bindOrdersCreate(client),
    ordersCancel: bindOrdersCancel(client),
    ordersRead: bindOrdersRead(client),
    detailRead: bindDetailRead(client),
    remindersCreate: bindRemindersCreate(client),
    ordersExport: bindOrdersExport(client),
    importsCreate: bindImportsCreate(client),
    importsRead: bindImportsRead(client),
    aftersalesRead: bindAftersalesRead(client),
    aftersaleattachmentsCreate: bindAftersaleattachmentsCreate(client),
    aftersalesApply: bindAftersalesApply(client),
    aftersalesApprove: bindAftersalesApprove(client),
    aftersalesReject: bindAftersalesReject(client),
    ordersReceive: bindOrdersReceive(client),
  }); }

export function createFetchOrderOrdersCreate(baseUrl: string): OperationMethod<"order.orders.create"> { return bindOrdersCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindOrdersCreate(client: OperationExecutor): OperationMethod<"order.orders.create"> { return bindOperation(client, defineOperation({ ...{"id":"order.orders.create","method":"POST","path":"/api/v1/orders","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":1500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CHECKOUT_BENEFIT_TIMEOUT","CHECKOUT_CART_TIMEOUT","CHECKOUT_CATALOG_TIMEOUT","CHECKOUT_EXPERIENCE_TIMEOUT","CHECKOUT_FINANCE_TIMEOUT","CHECKOUT_INVENTORY_TIMEOUT","CHECKOUT_MARKETING_TIMEOUT","CHECKOUT_MEMBER_TIMEOUT","CHECKOUT_ORDER_TIMEOUT","CHECKOUT_PRICING_TIMEOUT","CHECKOUT_QUALIFICATION_TIMEOUT","CHECKOUT_RISK_TIMEOUT","CHECKOUT_VOUCHER_TIMEOUT","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","INVENTORY_INSUFFICIENT","LISTING_NOT_PURCHASABLE","MARKETING_BUDGET_CONFLICT","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","PRICE_QUOTE_EXPIRED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","RISK_DENIED","RISK_REVIEW_REQUIRED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT","VOUCHER_NOT_USABLE"]}, input: exactOperationInput("OrderOrdersCreateInput", [] as const, true), output: exactOperationOutput("OrderOrdersCreateOutput") })); }

export function createFetchOrderOrdersCancel(baseUrl: string): OperationMethod<"order.orders.cancel"> { return bindOrdersCancel(new ApiClient(baseUrl, new FetchTransport())); }

function bindOrdersCancel(client: OperationExecutor): OperationMethod<"order.orders.cancel"> { return bindOperation(client, defineOperation({ ...{"id":"order.orders.cancel","method":"POST","path":"/api/v1/orders/{orderid}/cancel","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_NOT_CANCELLABLE","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("OrderOrdersCancelInput", ["orderid"] as const, true), output: exactOperationOutput("OrderOrdersCancelOutput") })); }

export function createFetchOrderOrdersRead(baseUrl: string): OperationMethod<"order.orders.read"> { return bindOrdersRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindOrdersRead(client: OperationExecutor): OperationMethod<"order.orders.read"> { return bindOperation(client, defineOperation({ ...{"id":"order.orders.read","method":"GET","path":"/api/v1/orders","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderOrdersReadInput", [] as const, false), output: exactOperationOutput("OrderOrdersReadOutput") })); }

export function createFetchOrderDetailRead(baseUrl: string): OperationMethod<"order.detail.read"> { return bindDetailRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindDetailRead(client: OperationExecutor): OperationMethod<"order.detail.read"> { return bindOperation(client, defineOperation({ ...{"id":"order.detail.read","method":"GET","path":"/api/v1/orders/{orderid}","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","RESOURCE_NOT_FOUND","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderDetailReadInput", ["orderid"] as const, false), output: exactOperationOutput("OrderDetailReadOutput") })); }

export function createFetchOrderRemindersCreate(baseUrl: string): OperationMethod<"order.reminders.create"> { return bindRemindersCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindRemindersCreate(client: OperationExecutor): OperationMethod<"order.reminders.create"> { return bindOperation(client, defineOperation({ ...{"id":"order.reminders.create","method":"POST","path":"/api/v1/orders/{orderid}/reminders","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","ORDER_REMINDER_NOT_ALLOWED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderRemindersCreateInput", ["orderid"] as const, true), output: exactOperationOutput("OrderRemindersCreateOutput") })); }

export function createFetchOrderOrdersExport(baseUrl: string): OperationMethod<"order.orders.export"> { return bindOrdersExport(new ApiClient(baseUrl, new FetchTransport())); }

function bindOrdersExport(client: OperationExecutor): OperationMethod<"order.orders.export"> { return bindOperation(client, defineOperation({ ...{"id":"order.orders.export","method":"POST","path":"/api/v1/orders/exports","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderOrdersExportInput", [] as const, true), output: exactOperationOutput("OrderOrdersExportOutput") })); }

export function createFetchOrderImportsCreate(baseUrl: string): OperationMethod<"order.imports.create"> { return bindImportsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsCreate(client: OperationExecutor): OperationMethod<"order.imports.create"> { return bindOperation(client, defineOperation({ ...{"id":"order.imports.create","method":"POST","path":"/api/v1/orders/imports","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":1500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_IMPORT_DUPLICATE","ORDER_IMPORT_EVIDENCE_INVALID","ORDER_IMPORT_MAPPING_INVALID","ORDER_IMPORT_ROW_FAILED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderImportsCreateInput", [] as const, true), output: exactOperationOutput("OrderImportsCreateOutput") })); }

export function createFetchOrderImportsRead(baseUrl: string): OperationMethod<"order.imports.read"> { return bindImportsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsRead(client: OperationExecutor): OperationMethod<"order.imports.read"> { return bindOperation(client, defineOperation({ ...{"id":"order.imports.read","method":"GET","path":"/api/v1/orders/imports/{importid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","RESOURCE_NOT_FOUND","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderImportsReadInput", ["importid"] as const, false), output: exactOperationOutput("OrderImportsReadOutput") })); }

export function createFetchOrderAftersalesRead(baseUrl: string): OperationMethod<"order.aftersales.read"> { return bindAftersalesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindAftersalesRead(client: OperationExecutor): OperationMethod<"order.aftersales.read"> { return bindOperation(client, defineOperation({ ...{"id":"order.aftersales.read","method":"GET","path":"/api/v1/orders/aftersales","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderAftersalesReadInput", [] as const, false), output: exactOperationOutput("OrderAftersalesReadOutput") })); }

export function createFetchOrderAftersaleattachmentsCreate(baseUrl: string): OperationMethod<"order.aftersaleattachments.create"> { return bindAftersaleattachmentsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindAftersaleattachmentsCreate(client: OperationExecutor): OperationMethod<"order.aftersaleattachments.create"> { return bindOperation(client, defineOperation({ ...{"id":"order.aftersaleattachments.create","method":"POST","path":"/api/v1/orders/{orderid}/aftersale-attachments","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderAftersaleattachmentsCreateInput", ["orderid"] as const, true), output: exactOperationOutput("OrderAftersaleattachmentsCreateOutput") })); }

export function createFetchOrderAftersalesApply(baseUrl: string): OperationMethod<"order.aftersales.apply"> { return bindAftersalesApply(new ApiClient(baseUrl, new FetchTransport())); }

function bindAftersalesApply(client: OperationExecutor): OperationMethod<"order.aftersales.apply"> { return bindOperation(client, defineOperation({ ...{"id":"order.aftersales.apply","method":"POST","path":"/api/v1/orders/{orderid}/aftersales","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrderAftersalesApplyInput", ["orderid"] as const, true), output: exactOperationOutput("OrderAftersalesApplyOutput") })); }

export function createFetchOrderAftersalesApprove(baseUrl: string): OperationMethod<"order.aftersales.approve"> { return bindAftersalesApprove(new ApiClient(baseUrl, new FetchTransport())); }

function bindAftersalesApprove(client: OperationExecutor): OperationMethod<"order.aftersales.approve"> { return bindOperation(client, defineOperation({ ...{"id":"order.aftersales.approve","method":"PUT","path":"/api/v1/orders/aftersales/{aftersaleid}/approval","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("OrderAftersalesApproveInput", ["aftersaleid"] as const, true), output: exactOperationOutput("OrderAftersalesApproveOutput") })); }

export function createFetchOrderAftersalesReject(baseUrl: string): OperationMethod<"order.aftersales.reject"> { return bindAftersalesReject(new ApiClient(baseUrl, new FetchTransport())); }

function bindAftersalesReject(client: OperationExecutor): OperationMethod<"order.aftersales.reject"> { return bindOperation(client, defineOperation({ ...{"id":"order.aftersales.reject","method":"DELETE","path":"/api/v1/orders/aftersales/{aftersaleid}/approval","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_AFTERSALE_NOT_ALLOWED","ORDER_NOT_CANCELLABLE","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("OrderAftersalesRejectInput", ["aftersaleid"] as const, true), output: exactOperationOutput("OrderAftersalesRejectOutput") })); }

export function createFetchOrderOrdersReceive(baseUrl: string): OperationMethod<"order.orders.receive"> { return bindOrdersReceive(new ApiClient(baseUrl, new FetchTransport())); }

function bindOrdersReceive(client: OperationExecutor): OperationMethod<"order.orders.receive"> { return bindOperation(client, defineOperation({ ...{"id":"order.orders.receive","method":"POST","path":"/api/v1/orders/{orderid}/receive","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORDER_RECEIPT_STATE_INVALID","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("OrderOrdersReceiveInput", ["orderid"] as const, true), output: exactOperationOutput("OrderOrdersReceiveOutput") })); }
