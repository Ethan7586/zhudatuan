// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const PARTNER_OPERATION_IDS = Object.freeze([
  "partner.partners.read",
  "partner.partners.manage",
] as const satisfies readonly OperationId[]);

export interface PartnerOperations {
  readonly partnersRead: OperationMethod<"partner.partners.read">;
  readonly partnersManage: OperationMethod<"partner.partners.manage">;
}

export function createFetchPartner(baseUrl: string): PartnerOperations { return createPartnerOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createPartnerOperations(client: OperationExecutor): PartnerOperations { return Object.freeze({
    partnersRead: bindPartnersRead(client),
    partnersManage: bindPartnersManage(client),
  }); }

export function createFetchPartnerPartnersRead(baseUrl: string): OperationMethod<"partner.partners.read"> { return bindPartnersRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindPartnersRead(client: OperationExecutor): OperationMethod<"partner.partners.read"> { return bindOperation(client, defineOperation({ ...{"id":"partner.partners.read","method":"GET","path":"/api/v1/partners","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("PartnerPartnersReadInput", [] as const, false), output: exactOperationOutput("PartnerPartnersReadOutput") })); }

export function createFetchPartnerPartnersManage(baseUrl: string): OperationMethod<"partner.partners.manage"> { return bindPartnersManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindPartnersManage(client: OperationExecutor): OperationMethod<"partner.partners.manage"> { return bindOperation(client, defineOperation({ ...{"id":"partner.partners.manage","method":"PUT","path":"/api/v1/partners/{partnerid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("PartnerPartnersManageInput", ["partnerid"] as const, true), output: exactOperationOutput("PartnerPartnersManageOutput") })); }
