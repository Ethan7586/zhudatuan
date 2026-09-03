// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const ORGANIZATION_OPERATION_IDS = Object.freeze([
  "organization.layers.read",
  "organization.stores.read",
  "organization.stores.manage",
  "organization.directories.read",
  "organization.directories.manage",
  "organization.directories.sync",
  "organization.directories.syncruns.read",
  "organization.directoryevents.receive",
] as const satisfies readonly OperationId[]);

export interface OrganizationOperations {
  readonly layersRead: OperationMethod<"organization.layers.read">;
  readonly storesRead: OperationMethod<"organization.stores.read">;
  readonly storesManage: OperationMethod<"organization.stores.manage">;
  readonly directoriesRead: OperationMethod<"organization.directories.read">;
  readonly directoriesManage: OperationMethod<"organization.directories.manage">;
  readonly directoriesSync: OperationMethod<"organization.directories.sync">;
  readonly directoriesSyncrunsRead: OperationMethod<"organization.directories.syncruns.read">;
  readonly directoryeventsReceive: OperationMethod<"organization.directoryevents.receive">;
}

export function createFetchOrganization(baseUrl: string): OrganizationOperations { return createOrganizationOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createOrganizationOperations(client: OperationExecutor): OrganizationOperations { return Object.freeze({
    layersRead: bindLayersRead(client),
    storesRead: bindStoresRead(client),
    storesManage: bindStoresManage(client),
    directoriesRead: bindDirectoriesRead(client),
    directoriesManage: bindDirectoriesManage(client),
    directoriesSync: bindDirectoriesSync(client),
    directoriesSyncrunsRead: bindDirectoriesSyncrunsRead(client),
    directoryeventsReceive: bindDirectoryeventsReceive(client),
  }); }

export function createFetchOrganizationLayersRead(baseUrl: string): OperationMethod<"organization.layers.read"> { return bindLayersRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindLayersRead(client: OperationExecutor): OperationMethod<"organization.layers.read"> { return bindOperation(client, defineOperation({ ...{"id":"organization.layers.read","method":"GET","path":"/api/v1/organizations/layers","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrganizationLayersReadInput", [] as const, false), output: exactOperationOutput("OrganizationLayersReadOutput") })); }

export function createFetchOrganizationStoresRead(baseUrl: string): OperationMethod<"organization.stores.read"> { return bindStoresRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindStoresRead(client: OperationExecutor): OperationMethod<"organization.stores.read"> { return bindOperation(client, defineOperation({ ...{"id":"organization.stores.read","method":"GET","path":"/api/v1/organizations/stores","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrganizationStoresReadInput", [] as const, false), output: exactOperationOutput("OrganizationStoresReadOutput") })); }

export function createFetchOrganizationStoresManage(baseUrl: string): OperationMethod<"organization.stores.manage"> { return bindStoresManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindStoresManage(client: OperationExecutor): OperationMethod<"organization.stores.manage"> { return bindOperation(client, defineOperation({ ...{"id":"organization.stores.manage","method":"PUT","path":"/api/v1/organizations/stores/{storeid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("OrganizationStoresManageInput", ["storeid"] as const, true), output: exactOperationOutput("OrganizationStoresManageOutput") })); }

export function createFetchOrganizationDirectoriesRead(baseUrl: string): OperationMethod<"organization.directories.read"> { return bindDirectoriesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindDirectoriesRead(client: OperationExecutor): OperationMethod<"organization.directories.read"> { return bindOperation(client, defineOperation({ ...{"id":"organization.directories.read","method":"GET","path":"/api/v1/organization/directories","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrganizationDirectoriesReadInput", [] as const, false), output: exactOperationOutput("OrganizationDirectoriesReadOutput") })); }

export function createFetchOrganizationDirectoriesManage(baseUrl: string): OperationMethod<"organization.directories.manage"> { return bindDirectoriesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindDirectoriesManage(client: OperationExecutor): OperationMethod<"organization.directories.manage"> { return bindOperation(client, defineOperation({ ...{"id":"organization.directories.manage","method":"PUT","path":"/api/v1/organization/directories/{directoryid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":1000,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","IDENTITY_PROVIDER_CONFIGURATION_INVALID","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrganizationDirectoriesManageInput", ["directoryid"] as const, true), output: exactOperationOutput("OrganizationDirectoriesManageOutput") })); }

export function createFetchOrganizationDirectoriesSync(baseUrl: string): OperationMethod<"organization.directories.sync"> { return bindDirectoriesSync(new ApiClient(baseUrl, new FetchTransport())); }

function bindDirectoriesSync(client: OperationExecutor): OperationMethod<"organization.directories.sync"> { return bindOperation(client, defineOperation({ ...{"id":"organization.directories.sync","method":"POST","path":"/api/v1/organization/directories/{directoryid}/syncs","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","IDENTITY_PROVIDER_DISABLED","INTERNAL_ERROR","ORIGIN_DENIED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrganizationDirectoriesSyncInput", ["directoryid"] as const, true), output: exactOperationOutput("OrganizationDirectoriesSyncOutput") })); }

export function createFetchOrganizationDirectoriesSyncrunsRead(baseUrl: string): OperationMethod<"organization.directories.syncruns.read"> { return bindDirectoriesSyncrunsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindDirectoriesSyncrunsRead(client: OperationExecutor): OperationMethod<"organization.directories.syncruns.read"> { return bindOperation(client, defineOperation({ ...{"id":"organization.directories.syncruns.read","method":"GET","path":"/api/v1/organization/directories/{directoryid}/syncruns","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrganizationDirectoriesSyncrunsReadInput", ["directoryid"] as const, false), output: exactOperationOutput("OrganizationDirectoriesSyncrunsReadOutput") })); }

export function createFetchOrganizationDirectoryeventsReceive(baseUrl: string): OperationMethod<"organization.directoryevents.receive"> { return bindDirectoryeventsReceive(new ApiClient(baseUrl, new FetchTransport())); }

function bindDirectoryeventsReceive(client: OperationExecutor): OperationMethod<"organization.directoryevents.receive"> { return bindOperation(client, defineOperation({ ...{"id":"organization.directoryevents.receive","method":"POST","path":"/api/v1/organization/directories/{directoryid}/events","audience":"webhook","targets":[],"responseMode":"empty","idempotent":false,"timeout":500,"errorUnion":["AUTHORIZATION_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","DIRECTORY_SYNC_STALE","INTERNAL_ERROR","PROVIDER_REPLAY_DETECTED","PROVIDER_SIGNATURE_INVALID","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("OrganizationDirectoryeventsReceiveInput", ["directoryid"] as const, true), output: exactOperationOutput("OrganizationDirectoryeventsReceiveOutput") })); }
