// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const ACCESS_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "access.center.read",
  "access.roles.manage",
  "access.scopes.manage",
] as const satisfies readonly OperationId[]);

export interface AccessOperations {
  readonly centerRead: OperationMethod<"access.center.read">;
  readonly rolesManage: OperationMethod<"access.roles.manage">;
  readonly scopesManage: OperationMethod<"access.scopes.manage">;
}

export function createFetchAccess(baseUrl: string): AccessOperations {
  return createAccessOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createAccessOperations(client: OperationExecutor): AccessOperations {
  return Object.freeze({
    centerRead: bindCenterRead(client),
    rolesManage: bindRolesManage(client),
    scopesManage: bindScopesManage(client),
  });
}

export function createFetchAccessCenterRead(baseUrl: string): OperationMethod<"access.center.read"> {
  return bindCenterRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCenterRead(client: OperationExecutor): OperationMethod<"access.center.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"access.center.read","method":"GET","path":"/api/v1/access/center","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchAccessRolesManage(baseUrl: string): OperationMethod<"access.roles.manage"> {
  return bindRolesManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRolesManage(client: OperationExecutor): OperationMethod<"access.roles.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"access.roles.manage","method":"PUT","path":"/api/v1/access/roles/{roleid}","audience":"operator","idempotent":true,"pathKeys":["roleid"]}));
}

export function createFetchAccessScopesManage(baseUrl: string): OperationMethod<"access.scopes.manage"> {
  return bindScopesManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindScopesManage(client: OperationExecutor): OperationMethod<"access.scopes.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"access.scopes.manage","method":"PUT","path":"/api/v1/access/memberships/{membershipid}/scopes","audience":"operator","idempotent":true,"pathKeys":["membershipid"]}));
}
