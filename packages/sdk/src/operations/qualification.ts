// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const QUALIFICATION_OPERATION_IDS = Object.freeze([
  "qualification.center.read",
  "qualification.decisions.preview",
  "qualification.policies.manage",
] as const satisfies readonly OperationId[]);

export interface QualificationOperations {
  readonly centerRead: OperationMethod<"qualification.center.read">;
  readonly decisionsPreview: OperationMethod<"qualification.decisions.preview">;
  readonly policiesManage: OperationMethod<"qualification.policies.manage">;
}

export function createFetchQualification(baseUrl: string): QualificationOperations { return createQualificationOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createQualificationOperations(client: OperationExecutor): QualificationOperations { return Object.freeze({
    centerRead: bindCenterRead(client),
    decisionsPreview: bindDecisionsPreview(client),
    policiesManage: bindPoliciesManage(client),
  }); }

export function createFetchQualificationCenterRead(baseUrl: string): OperationMethod<"qualification.center.read"> { return bindCenterRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindCenterRead(client: OperationExecutor): OperationMethod<"qualification.center.read"> { return bindOperation(client, defineOperation({ ...{"id":"qualification.center.read","method":"GET","path":"/api/v1/qualifications","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("QualificationCenterReadInput", [] as const, false), output: exactOperationOutput("QualificationCenterReadOutput") })); }

export function createFetchQualificationDecisionsPreview(baseUrl: string): OperationMethod<"qualification.decisions.preview"> { return bindDecisionsPreview(new ApiClient(baseUrl, new FetchTransport())); }

function bindDecisionsPreview(client: OperationExecutor): OperationMethod<"qualification.decisions.preview"> { return bindOperation(client, defineOperation({ ...{"id":"qualification.decisions.preview","method":"POST","path":"/api/v1/qualifications/decisions/preview","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("QualificationDecisionsPreviewInput", [] as const, true), output: exactOperationOutput("QualificationDecisionsPreviewOutput") })); }

export function createFetchQualificationPoliciesManage(baseUrl: string): OperationMethod<"qualification.policies.manage"> { return bindPoliciesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindPoliciesManage(client: OperationExecutor): OperationMethod<"qualification.policies.manage"> { return bindOperation(client, defineOperation({ ...{"id":"qualification.policies.manage","method":"PUT","path":"/api/v1/qualifications/policies/{policyid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("QualificationPoliciesManageInput", ["policyid"] as const, true), output: exactOperationOutput("QualificationPoliciesManageOutput") })); }
