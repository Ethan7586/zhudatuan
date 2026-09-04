// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const RISK_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "risk.center.read",
  "risk.policies.manage",
  "risk.cases.review",
] as const satisfies readonly OperationId[]);

export interface RiskOperations {
  readonly centerRead: OperationMethod<"risk.center.read">;
  readonly policiesManage: OperationMethod<"risk.policies.manage">;
  readonly casesReview: OperationMethod<"risk.cases.review">;
}

export function createFetchRisk(baseUrl: string): RiskOperations {
  return createRiskOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createRiskOperations(client: OperationExecutor): RiskOperations {
  return Object.freeze({
    centerRead: bindCenterRead(client),
    policiesManage: bindPoliciesManage(client),
    casesReview: bindCasesReview(client),
  });
}

export function createFetchRiskCenterRead(baseUrl: string): OperationMethod<"risk.center.read"> {
  return bindCenterRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCenterRead(client: OperationExecutor): OperationMethod<"risk.center.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"risk.center.read","method":"GET","path":"/api/v1/risks","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime","pathKeys":[]}));
}

export function createFetchRiskPoliciesManage(baseUrl: string): OperationMethod<"risk.policies.manage"> {
  return bindPoliciesManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPoliciesManage(client: OperationExecutor): OperationMethod<"risk.policies.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"risk.policies.manage","method":"PUT","path":"/api/v1/risks/policies/{policyid}","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime","pathKeys":["policyid"]}));
}

export function createFetchRiskCasesReview(baseUrl: string): OperationMethod<"risk.cases.review"> {
  return bindCasesReview(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCasesReview(client: OperationExecutor): OperationMethod<"risk.cases.review"> {
  return bindOperation(client, defineStructuralOperation({"id":"risk.cases.review","method":"PUT","path":"/api/v1/risks/cases/{caseid}","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime","pathKeys":["caseid"]}));
}
