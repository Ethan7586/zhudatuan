// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const ACCESS_OPERATION_IDS = Object.freeze([
  "access.center.read",
  "access.owners.transfer",
  "access.roles.manage",
  "access.overrides.manage",
  "access.scopes.manage",
] as const satisfies readonly OperationId[]);

export interface AccessOperations {
  readonly centerRead: OperationMethod<"access.center.read">;
  readonly ownersTransfer: OperationMethod<"access.owners.transfer">;
  readonly rolesManage: OperationMethod<"access.roles.manage">;
  readonly overridesManage: OperationMethod<"access.overrides.manage">;
  readonly scopesManage: OperationMethod<"access.scopes.manage">;
}

export function createFetchAccess(baseUrl: string): AccessOperations { return createAccessOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createAccessOperations(client: OperationExecutor): AccessOperations { return Object.freeze({
    centerRead: bindCenterRead(client),
    ownersTransfer: bindOwnersTransfer(client),
    rolesManage: bindRolesManage(client),
    overridesManage: bindOverridesManage(client),
    scopesManage: bindScopesManage(client),
  }); }

export function createFetchAccessCenterRead(baseUrl: string): OperationMethod<"access.center.read"> { return bindCenterRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindCenterRead(client: OperationExecutor): OperationMethod<"access.center.read"> { return bindOperation(client, defineOperation({ ...{"id":"access.center.read","method":"GET","path":"/api/v1/access/center","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("AccessCenterReadInput", [] as const, false), output: exactOperationOutput("AccessCenterReadOutput") })); }

export function createFetchAccessOwnersTransfer(baseUrl: string): OperationMethod<"access.owners.transfer"> { return bindOwnersTransfer(new ApiClient(baseUrl, new FetchTransport())); }

function bindOwnersTransfer(client: OperationExecutor): OperationMethod<"access.owners.transfer"> { return bindOperation(client, defineOperation({ ...{"id":"access.owners.transfer","method":"PUT","path":"/api/v1/access/owners/transfer","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","OWNER_TRANSFER_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("AccessOwnersTransferInput", [] as const, true), output: exactOperationOutput("AccessOwnersTransferOutput") })); }

export function createFetchAccessRolesManage(baseUrl: string): OperationMethod<"access.roles.manage"> { return bindRolesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindRolesManage(client: OperationExecutor): OperationMethod<"access.roles.manage"> { return bindOperation(client, defineOperation({ ...{"id":"access.roles.manage","method":"PUT","path":"/api/v1/access/roles/{roleid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("AccessRolesManageInput", ["roleid"] as const, true), output: exactOperationOutput("AccessRolesManageOutput") })); }

export function createFetchAccessOverridesManage(baseUrl: string): OperationMethod<"access.overrides.manage"> { return bindOverridesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindOverridesManage(client: OperationExecutor): OperationMethod<"access.overrides.manage"> { return bindOperation(client, defineOperation({ ...{"id":"access.overrides.manage","method":"PUT","path":"/api/v1/access/overrides","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","DELEGATION_DENIED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","OWNER_TRANSFER_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("AccessOverridesManageInput", [] as const, true), output: exactOperationOutput("AccessOverridesManageOutput") })); }

export function createFetchAccessScopesManage(baseUrl: string): OperationMethod<"access.scopes.manage"> { return bindScopesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindScopesManage(client: OperationExecutor): OperationMethod<"access.scopes.manage"> { return bindOperation(client, defineOperation({ ...{"id":"access.scopes.manage","method":"PUT","path":"/api/v1/access/scopes","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("AccessScopesManageInput", [] as const, true), output: exactOperationOutput("AccessScopesManageOutput") })); }
