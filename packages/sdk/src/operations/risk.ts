// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const RISK_OPERATION_IDS = Object.freeze([
  "risk.center.read",
  "risk.policies.manage",
  "risk.cases.review",
] as const satisfies readonly OperationId[]);

export interface RiskOperations {
  readonly centerRead: OperationMethod<"risk.center.read">;
  readonly policiesManage: OperationMethod<"risk.policies.manage">;
  readonly casesReview: OperationMethod<"risk.cases.review">;
}

export const RISK_METHOD_BY_OPERATION = Object.freeze({
  "risk.center.read": "centerRead",
  "risk.policies.manage": "policiesManage",
  "risk.cases.review": "casesReview",
} as const satisfies Readonly<Record<(typeof RISK_OPERATION_IDS)[number], keyof RiskOperations>>);

export function createFetchRisk(baseUrl: string): RiskOperations { return createRiskOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createRiskOperations(client: OperationExecutor): RiskOperations { return Object.freeze({
    centerRead: bindCenterRead(client),
    policiesManage: bindPoliciesManage(client),
    casesReview: bindCasesReview(client),
  }); }

export function createFetchRiskCenterRead(baseUrl: string): OperationMethod<"risk.center.read"> { return bindCenterRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindCenterRead(client: OperationExecutor): OperationMethod<"risk.center.read"> { return bindOperation(client, defineOperation({ ...{"id":"risk.center.read","method":"GET","path":"/api/v1/risks","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("RiskCenterReadInput", [] as const, false), output: exactOperationOutput("RiskCenterReadOutput") })); }

export function createFetchRiskPoliciesManage(baseUrl: string): OperationMethod<"risk.policies.manage"> { return bindPoliciesManage(new ApiClient(baseUrl, new FetchTransport())); }

export function bindPoliciesManage(client: OperationExecutor): OperationMethod<"risk.policies.manage"> { return bindOperation(client, defineOperation({ ...{"id":"risk.policies.manage","method":"PUT","path":"/api/v1/risks/policies/{policyid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("RiskPoliciesManageInput", ["policyid"] as const, true), output: exactOperationOutput("RiskPoliciesManageOutput") })); }

export function createFetchRiskCasesReview(baseUrl: string): OperationMethod<"risk.cases.review"> { return bindCasesReview(new ApiClient(baseUrl, new FetchTransport())); }

export function bindCasesReview(client: OperationExecutor): OperationMethod<"risk.cases.review"> { return bindOperation(client, defineOperation({ ...{"id":"risk.cases.review","method":"PUT","path":"/api/v1/risks/cases/{caseid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("RiskCasesReviewInput", ["caseid"] as const, true), output: exactOperationOutput("RiskCasesReviewOutput") })); }
