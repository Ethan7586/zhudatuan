// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const ACCESS_OPERATION_IDS = Object.freeze([
  "access.center.read",
  "access.ownership.read",
  "access.ownership.transfers.preview",
  "access.ownership.transfers.create",
  "access.ownership.transfers.accept.preview",
  "access.ownership.transfers.accept",
  "access.ownership.transfers.cancel.preview",
  "access.ownership.transfers.cancel",
  "access.roles.manage",
  "access.overrides.manage",
  "access.scopes.manage",
] as const satisfies readonly OperationId[]);

export interface AccessOperations {
  readonly centerRead: OperationMethod<"access.center.read">;
  readonly ownershipRead: OperationMethod<"access.ownership.read">;
  readonly ownershipTransfersPreview: OperationMethod<"access.ownership.transfers.preview">;
  readonly ownershipTransfersCreate: OperationMethod<"access.ownership.transfers.create">;
  readonly ownershipTransfersAcceptPreview: OperationMethod<"access.ownership.transfers.accept.preview">;
  readonly ownershipTransfersAccept: OperationMethod<"access.ownership.transfers.accept">;
  readonly ownershipTransfersCancelPreview: OperationMethod<"access.ownership.transfers.cancel.preview">;
  readonly ownershipTransfersCancel: OperationMethod<"access.ownership.transfers.cancel">;
  readonly rolesManage: OperationMethod<"access.roles.manage">;
  readonly overridesManage: OperationMethod<"access.overrides.manage">;
  readonly scopesManage: OperationMethod<"access.scopes.manage">;
}

export const ACCESS_METHOD_BY_OPERATION = Object.freeze({
  "access.center.read": "centerRead",
  "access.ownership.read": "ownershipRead",
  "access.ownership.transfers.preview": "ownershipTransfersPreview",
  "access.ownership.transfers.create": "ownershipTransfersCreate",
  "access.ownership.transfers.accept.preview": "ownershipTransfersAcceptPreview",
  "access.ownership.transfers.accept": "ownershipTransfersAccept",
  "access.ownership.transfers.cancel.preview": "ownershipTransfersCancelPreview",
  "access.ownership.transfers.cancel": "ownershipTransfersCancel",
  "access.roles.manage": "rolesManage",
  "access.overrides.manage": "overridesManage",
  "access.scopes.manage": "scopesManage",
} as const satisfies Readonly<Record<(typeof ACCESS_OPERATION_IDS)[number], keyof AccessOperations>>);

export function createFetchAccess(baseUrl: string): AccessOperations { return createAccessOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createAccessOperations(client: OperationExecutor): AccessOperations { return Object.freeze({
    centerRead: bindCenterRead(client),
    ownershipRead: bindOwnershipRead(client),
    ownershipTransfersPreview: bindOwnershipTransfersPreview(client),
    ownershipTransfersCreate: bindOwnershipTransfersCreate(client),
    ownershipTransfersAcceptPreview: bindOwnershipTransfersAcceptPreview(client),
    ownershipTransfersAccept: bindOwnershipTransfersAccept(client),
    ownershipTransfersCancelPreview: bindOwnershipTransfersCancelPreview(client),
    ownershipTransfersCancel: bindOwnershipTransfersCancel(client),
    rolesManage: bindRolesManage(client),
    overridesManage: bindOverridesManage(client),
    scopesManage: bindScopesManage(client),
  }); }

export function createFetchAccessCenterRead(baseUrl: string): OperationMethod<"access.center.read"> { return bindCenterRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindCenterRead(client: OperationExecutor): OperationMethod<"access.center.read"> { return bindOperation(client, defineOperation({ ...{"id":"access.center.read","method":"GET","path":"/api/v1/access/center","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("AccessCenterReadInput", [] as const, false), output: exactOperationOutput("AccessCenterReadOutput") })); }

export function createFetchAccessOwnershipRead(baseUrl: string): OperationMethod<"access.ownership.read"> { return bindOwnershipRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindOwnershipRead(client: OperationExecutor): OperationMethod<"access.ownership.read"> { return bindOperation(client, defineOperation({ ...{"id":"access.ownership.read","method":"GET","path":"/api/v1/access/ownership","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("AccessOwnershipReadInput", [] as const, false), output: exactOperationOutput("AccessOwnershipReadOutput") })); }

export function createFetchAccessOwnershipTransfersPreview(baseUrl: string): OperationMethod<"access.ownership.transfers.preview"> { return bindOwnershipTransfersPreview(new ApiClient(baseUrl, new FetchTransport())); }

function bindOwnershipTransfersPreview(client: OperationExecutor): OperationMethod<"access.ownership.transfers.preview"> { return bindOperation(client, defineOperation({ ...{"id":"access.ownership.transfers.preview","method":"POST","path":"/api/v1/access/ownership/transfers/preview","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","OWNER_TRANSFER_COOLING_PERIOD","OWNER_TRANSFER_EXPIRED","OWNER_TRANSFER_INVALID","OWNER_TRANSFER_PENDING","OWNER_TRANSFER_REQUIRED","OWNER_TRANSFER_ROLE_INVALID","OWNER_TRANSFER_STATE_INVALID","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("AccessOwnershipTransfersPreviewInput", [] as const, true), output: exactOperationOutput("AccessOwnershipTransfersPreviewOutput") })); }

export function createFetchAccessOwnershipTransfersCreate(baseUrl: string): OperationMethod<"access.ownership.transfers.create"> { return bindOwnershipTransfersCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindOwnershipTransfersCreate(client: OperationExecutor): OperationMethod<"access.ownership.transfers.create"> { return bindOperation(client, defineOperation({ ...{"id":"access.ownership.transfers.create","method":"POST","path":"/api/v1/access/ownership/transfers","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_DENIED","ORIGIN_REQUIRED","OWNER_TRANSFER_COOLING_PERIOD","OWNER_TRANSFER_EXPIRED","OWNER_TRANSFER_INVALID","OWNER_TRANSFER_PENDING","OWNER_TRANSFER_REQUIRED","OWNER_TRANSFER_ROLE_INVALID","OWNER_TRANSFER_STATE_INVALID","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("AccessOwnershipTransfersCreateInput", [] as const, true), output: exactOperationOutput("AccessOwnershipTransfersCreateOutput") })); }

export function createFetchAccessOwnershipTransfersAcceptPreview(baseUrl: string): OperationMethod<"access.ownership.transfers.accept.preview"> { return bindOwnershipTransfersAcceptPreview(new ApiClient(baseUrl, new FetchTransport())); }

function bindOwnershipTransfersAcceptPreview(client: OperationExecutor): OperationMethod<"access.ownership.transfers.accept.preview"> { return bindOperation(client, defineOperation({ ...{"id":"access.ownership.transfers.accept.preview","method":"POST","path":"/api/v1/access/ownership/transfers/{transferid}/accept/preview","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","OWNER_TRANSFER_COOLING_PERIOD","OWNER_TRANSFER_EXPIRED","OWNER_TRANSFER_INVALID","OWNER_TRANSFER_PENDING","OWNER_TRANSFER_REQUIRED","OWNER_TRANSFER_ROLE_INVALID","OWNER_TRANSFER_STATE_INVALID","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("AccessOwnershipTransfersAcceptPreviewInput", ["transferid"] as const, true), output: exactOperationOutput("AccessOwnershipTransfersAcceptPreviewOutput") })); }

export function createFetchAccessOwnershipTransfersAccept(baseUrl: string): OperationMethod<"access.ownership.transfers.accept"> { return bindOwnershipTransfersAccept(new ApiClient(baseUrl, new FetchTransport())); }

function bindOwnershipTransfersAccept(client: OperationExecutor): OperationMethod<"access.ownership.transfers.accept"> { return bindOperation(client, defineOperation({ ...{"id":"access.ownership.transfers.accept","method":"POST","path":"/api/v1/access/ownership/transfers/{transferid}/accept","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_DENIED","ORIGIN_REQUIRED","OWNER_TRANSFER_COOLING_PERIOD","OWNER_TRANSFER_EXPIRED","OWNER_TRANSFER_INVALID","OWNER_TRANSFER_PENDING","OWNER_TRANSFER_REQUIRED","OWNER_TRANSFER_ROLE_INVALID","OWNER_TRANSFER_STATE_INVALID","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("AccessOwnershipTransfersAcceptInput", ["transferid"] as const, true), output: exactOperationOutput("AccessOwnershipTransfersAcceptOutput") })); }

export function createFetchAccessOwnershipTransfersCancelPreview(baseUrl: string): OperationMethod<"access.ownership.transfers.cancel.preview"> { return bindOwnershipTransfersCancelPreview(new ApiClient(baseUrl, new FetchTransport())); }

function bindOwnershipTransfersCancelPreview(client: OperationExecutor): OperationMethod<"access.ownership.transfers.cancel.preview"> { return bindOperation(client, defineOperation({ ...{"id":"access.ownership.transfers.cancel.preview","method":"POST","path":"/api/v1/access/ownership/transfers/{transferid}/cancel/preview","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","OWNER_TRANSFER_COOLING_PERIOD","OWNER_TRANSFER_EXPIRED","OWNER_TRANSFER_INVALID","OWNER_TRANSFER_PENDING","OWNER_TRANSFER_REQUIRED","OWNER_TRANSFER_ROLE_INVALID","OWNER_TRANSFER_STATE_INVALID","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("AccessOwnershipTransfersCancelPreviewInput", ["transferid"] as const, true), output: exactOperationOutput("AccessOwnershipTransfersCancelPreviewOutput") })); }

export function createFetchAccessOwnershipTransfersCancel(baseUrl: string): OperationMethod<"access.ownership.transfers.cancel"> { return bindOwnershipTransfersCancel(new ApiClient(baseUrl, new FetchTransport())); }

function bindOwnershipTransfersCancel(client: OperationExecutor): OperationMethod<"access.ownership.transfers.cancel"> { return bindOperation(client, defineOperation({ ...{"id":"access.ownership.transfers.cancel","method":"POST","path":"/api/v1/access/ownership/transfers/{transferid}/cancel","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_DENIED","ORIGIN_REQUIRED","OWNER_TRANSFER_COOLING_PERIOD","OWNER_TRANSFER_EXPIRED","OWNER_TRANSFER_INVALID","OWNER_TRANSFER_PENDING","OWNER_TRANSFER_REQUIRED","OWNER_TRANSFER_ROLE_INVALID","OWNER_TRANSFER_STATE_INVALID","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("AccessOwnershipTransfersCancelInput", ["transferid"] as const, true), output: exactOperationOutput("AccessOwnershipTransfersCancelOutput") })); }

export function createFetchAccessRolesManage(baseUrl: string): OperationMethod<"access.roles.manage"> { return bindRolesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindRolesManage(client: OperationExecutor): OperationMethod<"access.roles.manage"> { return bindOperation(client, defineOperation({ ...{"id":"access.roles.manage","method":"PUT","path":"/api/v1/access/roles/{roleid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACCESS_GRANT_CONFLICT","ACCESS_SEPARATION_REQUIRED","ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("AccessRolesManageInput", ["roleid"] as const, true), output: exactOperationOutput("AccessRolesManageOutput") })); }

export function createFetchAccessOverridesManage(baseUrl: string): OperationMethod<"access.overrides.manage"> { return bindOverridesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindOverridesManage(client: OperationExecutor): OperationMethod<"access.overrides.manage"> { return bindOperation(client, defineOperation({ ...{"id":"access.overrides.manage","method":"PUT","path":"/api/v1/access/overrides","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","DELEGATION_DENIED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","OWNER_TRANSFER_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("AccessOverridesManageInput", [] as const, true), output: exactOperationOutput("AccessOverridesManageOutput") })); }

export function createFetchAccessScopesManage(baseUrl: string): OperationMethod<"access.scopes.manage"> { return bindScopesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindScopesManage(client: OperationExecutor): OperationMethod<"access.scopes.manage"> { return bindOperation(client, defineOperation({ ...{"id":"access.scopes.manage","method":"PUT","path":"/api/v1/access/scopes","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("AccessScopesManageInput", [] as const, true), output: exactOperationOutput("AccessScopesManageOutput") })); }
