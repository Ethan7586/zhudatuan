// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInputFrom, exactOperationOutputFrom } from '@shop/contract/operationschema';
import { INVOICE_BODY_SCHEMAS, INVOICE_QUERY_SCHEMAS, INVOICE_OUTPUT_SCHEMAS } from '@shop/contract/schema/Invoice';
import { defineOperation } from '../CatalogOperationDescriptor';

export const INVOICE_OPERATION_IDS = Object.freeze([
  "invoice.profiles.manage",
  "invoice.profiles.read",
  "invoice.requests.create",
  "invoice.requests.read",
  "invoice.requests.cancel",
  "invoice.requests.decide",
  "invoice.requests.red",
] as const satisfies readonly OperationId[]);

export interface InvoiceOperations {
  readonly profilesManage: OperationMethod<"invoice.profiles.manage">;
  readonly profilesRead: OperationMethod<"invoice.profiles.read">;
  readonly requestsCreate: OperationMethod<"invoice.requests.create">;
  readonly requestsRead: OperationMethod<"invoice.requests.read">;
  readonly requestsCancel: OperationMethod<"invoice.requests.cancel">;
  readonly requestsDecide: OperationMethod<"invoice.requests.decide">;
  readonly requestsRed: OperationMethod<"invoice.requests.red">;
}

export const INVOICE_METHOD_BY_OPERATION = Object.freeze({
  "invoice.profiles.manage": "profilesManage",
  "invoice.profiles.read": "profilesRead",
  "invoice.requests.create": "requestsCreate",
  "invoice.requests.read": "requestsRead",
  "invoice.requests.cancel": "requestsCancel",
  "invoice.requests.decide": "requestsDecide",
  "invoice.requests.red": "requestsRed",
} as const satisfies Readonly<Record<(typeof INVOICE_OPERATION_IDS)[number], keyof InvoiceOperations>>);

export function createFetchInvoice(baseUrl: string): InvoiceOperations { return createInvoiceOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createInvoiceOperations(client: OperationExecutor): InvoiceOperations { return Object.freeze({
    profilesManage: bindProfilesManage(client),
    profilesRead: bindProfilesRead(client),
    requestsCreate: bindRequestsCreate(client),
    requestsRead: bindRequestsRead(client),
    requestsCancel: bindRequestsCancel(client),
    requestsDecide: bindRequestsDecide(client),
    requestsRed: bindRequestsRed(client),
  }); }

export function createFetchInvoiceProfilesManage(baseUrl: string): OperationMethod<"invoice.profiles.manage"> { return bindProfilesManage(new ApiClient(baseUrl, new FetchTransport())); }

export function bindProfilesManage(client: OperationExecutor): OperationMethod<"invoice.profiles.manage"> { return bindOperation(client, defineOperation({ ...{"id":"invoice.profiles.manage","method":"PUT","path":"/api/v1/invoices/profiles/{profileid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(INVOICE_BODY_SCHEMAS.InvoiceProfilesManageInput, ["profileid"] as const, true), output: exactOperationOutputFrom(INVOICE_OUTPUT_SCHEMAS.InvoiceProfilesManageOutput) })); }

export function createFetchInvoiceProfilesRead(baseUrl: string): OperationMethod<"invoice.profiles.read"> { return bindProfilesRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindProfilesRead(client: OperationExecutor): OperationMethod<"invoice.profiles.read"> { return bindOperation(client, defineOperation({ ...{"id":"invoice.profiles.read","method":"GET","path":"/api/v1/invoices/profiles","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(INVOICE_QUERY_SCHEMAS.InvoiceProfilesReadInput, [] as const, false), output: exactOperationOutputFrom(INVOICE_OUTPUT_SCHEMAS.InvoiceProfilesReadOutput) })); }

export function createFetchInvoiceRequestsCreate(baseUrl: string): OperationMethod<"invoice.requests.create"> { return bindRequestsCreate(new ApiClient(baseUrl, new FetchTransport())); }

export function bindRequestsCreate(client: OperationExecutor): OperationMethod<"invoice.requests.create"> { return bindOperation(client, defineOperation({ ...{"id":"invoice.requests.create","method":"POST","path":"/api/v1/invoices/requests","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(INVOICE_BODY_SCHEMAS.InvoiceRequestsCreateInput, [] as const, true), output: exactOperationOutputFrom(INVOICE_OUTPUT_SCHEMAS.InvoiceRequestsCreateOutput) })); }

export function createFetchInvoiceRequestsRead(baseUrl: string): OperationMethod<"invoice.requests.read"> { return bindRequestsRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindRequestsRead(client: OperationExecutor): OperationMethod<"invoice.requests.read"> { return bindOperation(client, defineOperation({ ...{"id":"invoice.requests.read","method":"GET","path":"/api/v1/invoices/requests","audience":"console","targets":["console","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(INVOICE_QUERY_SCHEMAS.InvoiceRequestsReadInput, [] as const, false), output: exactOperationOutputFrom(INVOICE_OUTPUT_SCHEMAS.InvoiceRequestsReadOutput) })); }

export function createFetchInvoiceRequestsCancel(baseUrl: string): OperationMethod<"invoice.requests.cancel"> { return bindRequestsCancel(new ApiClient(baseUrl, new FetchTransport())); }

export function bindRequestsCancel(client: OperationExecutor): OperationMethod<"invoice.requests.cancel"> { return bindOperation(client, defineOperation({ ...{"id":"invoice.requests.cancel","method":"DELETE","path":"/api/v1/invoices/requests/{requestid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(INVOICE_BODY_SCHEMAS.InvoiceRequestsCancelInput, ["requestid"] as const, true), output: exactOperationOutputFrom(INVOICE_OUTPUT_SCHEMAS.InvoiceRequestsCancelOutput) })); }

export function createFetchInvoiceRequestsDecide(baseUrl: string): OperationMethod<"invoice.requests.decide"> { return bindRequestsDecide(new ApiClient(baseUrl, new FetchTransport())); }

export function bindRequestsDecide(client: OperationExecutor): OperationMethod<"invoice.requests.decide"> { return bindOperation(client, defineOperation({ ...{"id":"invoice.requests.decide","method":"POST","path":"/api/v1/invoices/requests/{requestid}/decide","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(INVOICE_BODY_SCHEMAS.InvoiceRequestsDecideInput, ["requestid"] as const, true), output: exactOperationOutputFrom(INVOICE_OUTPUT_SCHEMAS.InvoiceRequestsDecideOutput) })); }

export function createFetchInvoiceRequestsRed(baseUrl: string): OperationMethod<"invoice.requests.red"> { return bindRequestsRed(new ApiClient(baseUrl, new FetchTransport())); }

export function bindRequestsRed(client: OperationExecutor): OperationMethod<"invoice.requests.red"> { return bindOperation(client, defineOperation({ ...{"id":"invoice.requests.red","method":"POST","path":"/api/v1/invoices/requests/{requestid}/red","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","FINANCE_JOURNAL_UNBALANCED","FINANCE_SETTLEMENT_AMOUNT_INVALID","FINANCE_SETTLEMENT_FEE_INVALID","FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID","FINANCE_SETTLEMENT_NET_INVALID","FINANCE_SETTLEMENT_SEPARATION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(INVOICE_BODY_SCHEMAS.InvoiceRequestsRedInput, ["requestid"] as const, true), output: exactOperationOutputFrom(INVOICE_OUTPUT_SCHEMAS.InvoiceRequestsRedOutput) })); }
