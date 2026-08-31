// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

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

export function createFetchNavigation(baseUrl: string): NavigationOperations { return createNavigationOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createNavigationOperations(client: OperationExecutor): NavigationOperations { return Object.freeze({
    treeRead: bindTreeRead(client),
    catalogRead: bindCatalogRead(client),
    healthRead: bindHealthRead(client),
  }); }

export function createFetchNavigationTreeRead(baseUrl: string): OperationMethod<"navigation.tree.read"> { return bindTreeRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindTreeRead(client: OperationExecutor): OperationMethod<"navigation.tree.read"> { return bindOperation(client, defineOperation({"id":"navigation.tree.read","method":"GET","path":"/api/v1/navigation","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":300})); }

export function createFetchNavigationCatalogRead(baseUrl: string): OperationMethod<"navigation.catalog.read"> { return bindCatalogRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindCatalogRead(client: OperationExecutor): OperationMethod<"navigation.catalog.read"> { return bindOperation(client, defineOperation({"id":"navigation.catalog.read","method":"GET","path":"/api/v1/navigation/catalog","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":300})); }

export function createFetchNavigationHealthRead(baseUrl: string): OperationMethod<"navigation.health.read"> { return bindHealthRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindHealthRead(client: OperationExecutor): OperationMethod<"navigation.health.read"> { return bindOperation(client, defineOperation({"id":"navigation.health.read","method":"GET","path":"/api/v1/navigation/health","audience":"system","targets":[],"responseMode":"json","idempotent":true,"timeout":200})); }
