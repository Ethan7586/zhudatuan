// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const PARTNER_OPERATION_IDS = Object.freeze([
  "partner.partners.read",
  "partner.customers.create",
  "partner.customers.update",
  "partner.customers.enable",
  "partner.customers.disable",
  "partner.customers.get",
  "partner.customers.list",
  "partner.customeroptions.list",
  "partner.partners.manage",
] as const satisfies readonly OperationId[]);

export interface PartnerOperations {
  readonly partnersRead: OperationMethod<"partner.partners.read">;
  readonly customersCreate: OperationMethod<"partner.customers.create">;
  readonly customersUpdate: OperationMethod<"partner.customers.update">;
  readonly customersEnable: OperationMethod<"partner.customers.enable">;
  readonly customersDisable: OperationMethod<"partner.customers.disable">;
  readonly customersGet: OperationMethod<"partner.customers.get">;
  readonly customersList: OperationMethod<"partner.customers.list">;
  readonly customeroptionsList: OperationMethod<"partner.customeroptions.list">;
  readonly partnersManage: OperationMethod<"partner.partners.manage">;
}

export const PARTNER_METHOD_BY_OPERATION = Object.freeze({
  "partner.partners.read": "partnersRead",
  "partner.customers.create": "customersCreate",
  "partner.customers.update": "customersUpdate",
  "partner.customers.enable": "customersEnable",
  "partner.customers.disable": "customersDisable",
  "partner.customers.get": "customersGet",
  "partner.customers.list": "customersList",
  "partner.customeroptions.list": "customeroptionsList",
  "partner.partners.manage": "partnersManage",
} as const satisfies Readonly<Record<(typeof PARTNER_OPERATION_IDS)[number], keyof PartnerOperations>>);

export function createFetchPartner(baseUrl: string): PartnerOperations { return createPartnerOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createPartnerOperations(client: OperationExecutor): PartnerOperations { return Object.freeze({
    partnersRead: bindPartnersRead(client),
    customersCreate: bindCustomersCreate(client),
    customersUpdate: bindCustomersUpdate(client),
    customersEnable: bindCustomersEnable(client),
    customersDisable: bindCustomersDisable(client),
    customersGet: bindCustomersGet(client),
    customersList: bindCustomersList(client),
    customeroptionsList: bindCustomeroptionsList(client),
    partnersManage: bindPartnersManage(client),
  }); }

export function createFetchPartnerPartnersRead(baseUrl: string): OperationMethod<"partner.partners.read"> { return bindPartnersRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindPartnersRead(client: OperationExecutor): OperationMethod<"partner.partners.read"> { return bindOperation(client, defineOperation({ ...{"id":"partner.partners.read","method":"GET","path":"/api/v1/partners","audience":"console","targets":["console","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("PartnerPartnersReadInput", [] as const, false), output: exactOperationOutput("PartnerPartnersReadOutput") })); }

export function createFetchPartnerCustomersCreate(baseUrl: string): OperationMethod<"partner.customers.create"> { return bindCustomersCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindCustomersCreate(client: OperationExecutor): OperationMethod<"partner.customers.create"> { return bindOperation(client, defineOperation({ ...{"id":"partner.customers.create","method":"POST","path":"/api/v1/partners/customers","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","PARTNER_AGREEMENT_PERIOD_INVALID","PARTNER_CONTACT_INVALID","PARTNER_CUSTOMER_IDENTIFIER_CONFLICT","PARTNER_CUSTOMER_STATE_INVALID","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("PartnerCustomersCreateInput", [] as const, true), output: exactOperationOutput("PartnerCustomersCreateOutput") })); }

export function createFetchPartnerCustomersUpdate(baseUrl: string): OperationMethod<"partner.customers.update"> { return bindCustomersUpdate(new ApiClient(baseUrl, new FetchTransport())); }

function bindCustomersUpdate(client: OperationExecutor): OperationMethod<"partner.customers.update"> { return bindOperation(client, defineOperation({ ...{"id":"partner.customers.update","method":"PATCH","path":"/api/v1/partners/customers/{customerid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","PARTNER_AGREEMENT_PERIOD_INVALID","PARTNER_CONTACT_INVALID","PARTNER_CUSTOMER_IDENTIFIER_CONFLICT","PARTNER_CUSTOMER_STATE_INVALID","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("PartnerCustomersUpdateInput", ["customerid"] as const, true), output: exactOperationOutput("PartnerCustomersUpdateOutput") })); }

export function createFetchPartnerCustomersEnable(baseUrl: string): OperationMethod<"partner.customers.enable"> { return bindCustomersEnable(new ApiClient(baseUrl, new FetchTransport())); }

function bindCustomersEnable(client: OperationExecutor): OperationMethod<"partner.customers.enable"> { return bindOperation(client, defineOperation({ ...{"id":"partner.customers.enable","method":"POST","path":"/api/v1/partners/customers/{customerid}/enable","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","PARTNER_AGREEMENT_PERIOD_INVALID","PARTNER_CONTACT_INVALID","PARTNER_CUSTOMER_IDENTIFIER_CONFLICT","PARTNER_CUSTOMER_STATE_INVALID","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("PartnerCustomersEnableInput", ["customerid"] as const, true), output: exactOperationOutput("PartnerCustomersEnableOutput") })); }

export function createFetchPartnerCustomersDisable(baseUrl: string): OperationMethod<"partner.customers.disable"> { return bindCustomersDisable(new ApiClient(baseUrl, new FetchTransport())); }

function bindCustomersDisable(client: OperationExecutor): OperationMethod<"partner.customers.disable"> { return bindOperation(client, defineOperation({ ...{"id":"partner.customers.disable","method":"POST","path":"/api/v1/partners/customers/{customerid}/disable","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","PARTNER_AGREEMENT_PERIOD_INVALID","PARTNER_CONTACT_INVALID","PARTNER_CUSTOMER_IDENTIFIER_CONFLICT","PARTNER_CUSTOMER_STATE_INVALID","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("PartnerCustomersDisableInput", ["customerid"] as const, true), output: exactOperationOutput("PartnerCustomersDisableOutput") })); }

export function createFetchPartnerCustomersGet(baseUrl: string): OperationMethod<"partner.customers.get"> { return bindCustomersGet(new ApiClient(baseUrl, new FetchTransport())); }

function bindCustomersGet(client: OperationExecutor): OperationMethod<"partner.customers.get"> { return bindOperation(client, defineOperation({ ...{"id":"partner.customers.get","method":"GET","path":"/api/v1/partners/customers/{customerid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","RESOURCE_NOT_FOUND","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("PartnerCustomersGetInput", ["customerid"] as const, false), output: exactOperationOutput("PartnerCustomersGetOutput") })); }

export function createFetchPartnerCustomersList(baseUrl: string): OperationMethod<"partner.customers.list"> { return bindCustomersList(new ApiClient(baseUrl, new FetchTransport())); }

function bindCustomersList(client: OperationExecutor): OperationMethod<"partner.customers.list"> { return bindOperation(client, defineOperation({ ...{"id":"partner.customers.list","method":"GET","path":"/api/v1/partners/customers","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","RESOURCE_NOT_FOUND","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("PartnerCustomersListInput", [] as const, false), output: exactOperationOutput("PartnerCustomersListOutput") })); }

export function createFetchPartnerCustomeroptionsList(baseUrl: string): OperationMethod<"partner.customeroptions.list"> { return bindCustomeroptionsList(new ApiClient(baseUrl, new FetchTransport())); }

function bindCustomeroptionsList(client: OperationExecutor): OperationMethod<"partner.customeroptions.list"> { return bindOperation(client, defineOperation({ ...{"id":"partner.customeroptions.list","method":"GET","path":"/api/v1/partners/customer-options","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","RESOURCE_NOT_FOUND","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("PartnerCustomeroptionsListInput", [] as const, false), output: exactOperationOutput("PartnerCustomeroptionsListOutput") })); }

export function createFetchPartnerPartnersManage(baseUrl: string): OperationMethod<"partner.partners.manage"> { return bindPartnersManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindPartnersManage(client: OperationExecutor): OperationMethod<"partner.partners.manage"> { return bindOperation(client, defineOperation({ ...{"id":"partner.partners.manage","method":"PUT","path":"/api/v1/partners/{partnerid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("PartnerPartnersManageInput", ["partnerid"] as const, true), output: exactOperationOutput("PartnerPartnersManageOutput") })); }
