// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, defineOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

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

function bindCenterRead(client: OperationExecutor): OperationMethod<"qualification.center.read"> { return bindOperation(client, defineOperation({"id":"qualification.center.read","method":"GET","path":"/api/v1/qualifications","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchQualificationDecisionsPreview(baseUrl: string): OperationMethod<"qualification.decisions.preview"> { return bindDecisionsPreview(new ApiClient(baseUrl, new FetchTransport())); }

function bindDecisionsPreview(client: OperationExecutor): OperationMethod<"qualification.decisions.preview"> { return bindOperation(client, defineOperation({"id":"qualification.decisions.preview","method":"POST","path":"/api/v1/qualifications/decisions/preview","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchQualificationPoliciesManage(baseUrl: string): OperationMethod<"qualification.policies.manage"> { return bindPoliciesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindPoliciesManage(client: OperationExecutor): OperationMethod<"qualification.policies.manage"> { return bindOperation(client, defineOperation({"id":"qualification.policies.manage","method":"PUT","path":"/api/v1/qualifications/policies/{policyid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }
