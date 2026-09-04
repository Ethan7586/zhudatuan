// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const CAPABILITY_OPERATION_IDS = Object.freeze([
  "capability.assignments.read",
  "capability.assignments.manage",
] as const satisfies readonly OperationId[]);

export interface CapabilityOperations {
  readonly assignmentsRead: OperationMethod<"capability.assignments.read">;
  readonly assignmentsManage: OperationMethod<"capability.assignments.manage">;
}

export function createFetchCapability(baseUrl: string): CapabilityOperations { return createCapabilityOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createCapabilityOperations(client: OperationExecutor): CapabilityOperations { return Object.freeze({
    assignmentsRead: bindAssignmentsRead(client),
    assignmentsManage: bindAssignmentsManage(client),
  }); }

export function createFetchCapabilityAssignmentsRead(baseUrl: string): OperationMethod<"capability.assignments.read"> { return bindAssignmentsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindAssignmentsRead(client: OperationExecutor): OperationMethod<"capability.assignments.read"> { return bindOperation(client, defineOperation({ ...{"id":"capability.assignments.read","method":"GET","path":"/api/v1/capabilities/assignments","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("CapabilityAssignmentsReadInput", [] as const, false), output: exactOperationOutput("CapabilityAssignmentsReadOutput") })); }

export function createFetchCapabilityAssignmentsManage(baseUrl: string): OperationMethod<"capability.assignments.manage"> { return bindAssignmentsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindAssignmentsManage(client: OperationExecutor): OperationMethod<"capability.assignments.manage"> { return bindOperation(client, defineOperation({ ...{"id":"capability.assignments.manage","method":"PUT","path":"/api/v1/capabilities/assignments/{assignmentid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("CapabilityAssignmentsManageInput", ["assignmentid"] as const, true), output: exactOperationOutput("CapabilityAssignmentsManageOutput") })); }
