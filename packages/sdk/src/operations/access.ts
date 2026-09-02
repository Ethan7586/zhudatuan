// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, defineOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

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

function bindCenterRead(client: OperationExecutor): OperationMethod<"access.center.read"> { return bindOperation(client, defineOperation({"id":"access.center.read","method":"GET","path":"/api/v1/access/center","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchAccessOwnersTransfer(baseUrl: string): OperationMethod<"access.owners.transfer"> { return bindOwnersTransfer(new ApiClient(baseUrl, new FetchTransport())); }

function bindOwnersTransfer(client: OperationExecutor): OperationMethod<"access.owners.transfer"> { return bindOperation(client, defineOperation({"id":"access.owners.transfer","method":"PUT","path":"/api/v1/access/owners/transfer","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchAccessRolesManage(baseUrl: string): OperationMethod<"access.roles.manage"> { return bindRolesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindRolesManage(client: OperationExecutor): OperationMethod<"access.roles.manage"> { return bindOperation(client, defineOperation({"id":"access.roles.manage","method":"PUT","path":"/api/v1/access/roles/{roleid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchAccessOverridesManage(baseUrl: string): OperationMethod<"access.overrides.manage"> { return bindOverridesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindOverridesManage(client: OperationExecutor): OperationMethod<"access.overrides.manage"> { return bindOperation(client, defineOperation({"id":"access.overrides.manage","method":"PUT","path":"/api/v1/access/overrides","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchAccessScopesManage(baseUrl: string): OperationMethod<"access.scopes.manage"> { return bindScopesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindScopesManage(client: OperationExecutor): OperationMethod<"access.scopes.manage"> { return bindOperation(client, defineOperation({"id":"access.scopes.manage","method":"PUT","path":"/api/v1/access/scopes","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }
