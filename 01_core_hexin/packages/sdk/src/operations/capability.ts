// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const CAPABILITY_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "capability.assignments.read",
  "capability.assignments.manage",
] as const satisfies readonly OperationId[]);

export interface CapabilityOperations {
  readonly assignmentsRead: OperationMethod<"capability.assignments.read">;
  readonly assignmentsManage: OperationMethod<"capability.assignments.manage">;
}

export function createFetchCapability(baseUrl: string): CapabilityOperations {
  return createCapabilityOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createCapabilityOperations(client: OperationExecutor): CapabilityOperations {
  return Object.freeze({
    assignmentsRead: bindAssignmentsRead(client),
    assignmentsManage: bindAssignmentsManage(client),
  });
}

export function createFetchCapabilityAssignmentsRead(baseUrl: string): OperationMethod<"capability.assignments.read"> {
  return bindAssignmentsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAssignmentsRead(client: OperationExecutor): OperationMethod<"capability.assignments.read"> {
  return bindOperation(client, defineContractOperation({"id":"capability.assignments.read","method":"GET","path":"/api/v1/capabilities/assignments","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchCapabilityAssignmentsManage(baseUrl: string): OperationMethod<"capability.assignments.manage"> {
  return bindAssignmentsManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAssignmentsManage(client: OperationExecutor): OperationMethod<"capability.assignments.manage"> {
  return bindOperation(client, defineContractOperation({"id":"capability.assignments.manage","method":"PUT","path":"/api/v1/capabilities/assignments/{assignmentid}","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}
