// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const ACCESS_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "access.center.read",
  "access.roles.manage",
  "access.scopes.manage",
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  "access.ownership.read",
  "access.ownership.transfers.preview",
  "access.ownership.transfers.create",
  "access.ownership.transfers.accept.preview",
  "access.ownership.transfers.accept",
  "access.ownership.transfers.cancel",
  "access.ownership.transfers.cancel.preview",
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
] as const satisfies readonly OperationId[]);

export interface AccessOperations {
  readonly centerRead: OperationMethod<"access.center.read">;
  readonly rolesManage: OperationMethod<"access.roles.manage">;
  readonly scopesManage: OperationMethod<"access.scopes.manage">;
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  readonly ownershipRead: OperationMethod<"access.ownership.read">;
  readonly ownershipTransfersPreview: OperationMethod<"access.ownership.transfers.preview">;
  readonly ownershipTransfersCreate: OperationMethod<"access.ownership.transfers.create">;
  readonly ownershipTransfersAcceptPreview: OperationMethod<"access.ownership.transfers.accept.preview">;
  readonly ownershipTransfersAccept: OperationMethod<"access.ownership.transfers.accept">;
  readonly ownershipTransfersCancel: OperationMethod<"access.ownership.transfers.cancel">;
  readonly ownershipTransfersCancelPreview: OperationMethod<"access.ownership.transfers.cancel.preview">;
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
}

export function createFetchAccess(baseUrl: string): AccessOperations {
  return createAccessOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createAccessOperations(client: OperationExecutor): AccessOperations {
  return Object.freeze({
    centerRead: bindCenterRead(client),
    rolesManage: bindRolesManage(client),
    scopesManage: bindScopesManage(client),
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    ownershipRead: bindOwnershipRead(client),
    ownershipTransfersPreview: bindOwnershipTransfersPreview(client),
    ownershipTransfersCreate: bindOwnershipTransfersCreate(client),
    ownershipTransfersAcceptPreview: bindOwnershipTransfersAcceptPreview(client),
    ownershipTransfersAccept: bindOwnershipTransfersAccept(client),
    ownershipTransfersCancel: bindOwnershipTransfersCancel(client),
    ownershipTransfersCancelPreview: bindOwnershipTransfersCancelPreview(client),
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

export function createFetchAccessOwnershipRead(baseUrl: string): OperationMethod<"access.ownership.read"> {
  return bindOwnershipRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOwnershipRead(client: OperationExecutor): OperationMethod<"access.ownership.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"access.ownership.read","method":"GET","path":"/api/v1/access/ownership","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchAccessOwnershipTransfersPreview(baseUrl: string): OperationMethod<"access.ownership.transfers.preview"> {
  return bindOwnershipTransfersPreview(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOwnershipTransfersPreview(client: OperationExecutor): OperationMethod<"access.ownership.transfers.preview"> {
  return bindOperation(client, defineStructuralOperation({"id":"access.ownership.transfers.preview","method":"POST","path":"/api/v1/access/ownership/transfers/preview","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchAccessOwnershipTransfersCreate(baseUrl: string): OperationMethod<"access.ownership.transfers.create"> {
  return bindOwnershipTransfersCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOwnershipTransfersCreate(client: OperationExecutor): OperationMethod<"access.ownership.transfers.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"access.ownership.transfers.create","method":"POST","path":"/api/v1/access/ownership/transfers","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchAccessOwnershipTransfersAcceptPreview(baseUrl: string): OperationMethod<"access.ownership.transfers.accept.preview"> {
  return bindOwnershipTransfersAcceptPreview(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOwnershipTransfersAcceptPreview(client: OperationExecutor): OperationMethod<"access.ownership.transfers.accept.preview"> {
  return bindOperation(client, defineStructuralOperation({"id":"access.ownership.transfers.accept.preview","method":"POST","path":"/api/v1/access/ownership/transfers/{transferid}/accept/preview","audience":"operator","idempotent":true,"pathKeys":["transferid"]}));
}

export function createFetchAccessOwnershipTransfersAccept(baseUrl: string): OperationMethod<"access.ownership.transfers.accept"> {
  return bindOwnershipTransfersAccept(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOwnershipTransfersAccept(client: OperationExecutor): OperationMethod<"access.ownership.transfers.accept"> {
  return bindOperation(client, defineStructuralOperation({"id":"access.ownership.transfers.accept","method":"POST","path":"/api/v1/access/ownership/transfers/{transferid}/accept","audience":"operator","idempotent":true,"pathKeys":["transferid"]}));
}

export function createFetchAccessOwnershipTransfersCancel(baseUrl: string): OperationMethod<"access.ownership.transfers.cancel"> {
  return bindOwnershipTransfersCancel(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOwnershipTransfersCancel(client: OperationExecutor): OperationMethod<"access.ownership.transfers.cancel"> {
  return bindOperation(client, defineStructuralOperation({"id":"access.ownership.transfers.cancel","method":"POST","path":"/api/v1/access/ownership/transfers/{transferid}/cancel","audience":"operator","idempotent":true,"pathKeys":["transferid"]}));
}

export function createFetchAccessOwnershipTransfersCancelPreview(baseUrl: string): OperationMethod<"access.ownership.transfers.cancel.preview"> {
  return bindOwnershipTransfersCancelPreview(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOwnershipTransfersCancelPreview(client: OperationExecutor): OperationMethod<"access.ownership.transfers.cancel.preview"> {
  return bindOperation(client, defineStructuralOperation({"id":"access.ownership.transfers.cancel.preview","method":"POST","path":"/api/v1/access/ownership/transfers/{transferid}/cancel/preview","audience":"operator","idempotent":true,"pathKeys":["transferid"]}));
}
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
