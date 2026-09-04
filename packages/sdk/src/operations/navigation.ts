// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const NAVIGATION_OPERATION_IDS = Object.freeze([
  "navigation.tree.read",
  "navigation.catalog.read",
  "navigation.health.read",
] as const satisfies readonly OperationId[]);

export interface NavigationOperations {
  readonly treeRead: OperationMethod<"navigation.tree.read">;
  readonly catalogRead: OperationMethod<"navigation.catalog.read">;
  readonly healthRead: OperationMethod<"navigation.health.read">;
}

export const NAVIGATION_METHOD_BY_OPERATION = Object.freeze({
  "navigation.tree.read": "treeRead",
  "navigation.catalog.read": "catalogRead",
  "navigation.health.read": "healthRead",
} as const satisfies Readonly<Record<(typeof NAVIGATION_OPERATION_IDS)[number], keyof NavigationOperations>>);

export function createFetchNavigation(baseUrl: string): NavigationOperations { return createNavigationOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createNavigationOperations(client: OperationExecutor): NavigationOperations { return Object.freeze({
    treeRead: bindTreeRead(client),
    catalogRead: bindCatalogRead(client),
    healthRead: bindHealthRead(client),
  }); }

export function createFetchNavigationTreeRead(baseUrl: string): OperationMethod<"navigation.tree.read"> { return bindTreeRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindTreeRead(client: OperationExecutor): OperationMethod<"navigation.tree.read"> { return bindOperation(client, defineOperation({ ...{"id":"navigation.tree.read","method":"GET","path":"/api/v1/navigation","audience":"console","targets":["console","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":300,"errorUnion":["ACCESS_VERSION_STALE","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","NAVIGATION_CATALOG_MISMATCH","NAVIGATION_EMPTY","NAVIGATION_SCOPE_DENIED","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("NavigationTreeReadInput", [] as const, false), output: exactOperationOutput("NavigationTreeReadOutput") })); }

export function createFetchNavigationCatalogRead(baseUrl: string): OperationMethod<"navigation.catalog.read"> { return bindCatalogRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindCatalogRead(client: OperationExecutor): OperationMethod<"navigation.catalog.read"> { return bindOperation(client, defineOperation({ ...{"id":"navigation.catalog.read","method":"GET","path":"/api/v1/navigation/catalog","audience":"console","targets":["console","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":300,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("NavigationCatalogReadInput", [] as const, false), output: exactOperationOutput("NavigationCatalogReadOutput") })); }

export function createFetchNavigationHealthRead(baseUrl: string): OperationMethod<"navigation.health.read"> { return bindHealthRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindHealthRead(client: OperationExecutor): OperationMethod<"navigation.health.read"> { return bindOperation(client, defineOperation({ ...{"id":"navigation.health.read","method":"GET","path":"/api/v1/navigation/health","audience":"system","targets":[],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":200,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("NavigationHealthReadInput", [] as const, false), output: exactOperationOutput("NavigationHealthReadOutput") })); }
