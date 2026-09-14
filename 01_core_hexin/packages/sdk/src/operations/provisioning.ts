// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const PROVISIONING_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "provisioning.malls.create",
  "provisioning.malls.read",
  "provisioning.nodetasks.read",
  "provisioning.nodetasks.retry",
] as const satisfies readonly OperationId[]);

export interface ProvisioningOperations {
  readonly mallsCreate: OperationMethod<"provisioning.malls.create">;
  readonly mallsRead: OperationMethod<"provisioning.malls.read">;
  readonly nodetasksRead: OperationMethod<"provisioning.nodetasks.read">;
  readonly nodetasksRetry: OperationMethod<"provisioning.nodetasks.retry">;
}

export function createFetchProvisioning(baseUrl: string): ProvisioningOperations {
  return createProvisioningOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createProvisioningOperations(client: OperationExecutor): ProvisioningOperations {
  return Object.freeze({
    mallsCreate: bindMallsCreate(client),
    mallsRead: bindMallsRead(client),
    nodetasksRead: bindNodetasksRead(client),
    nodetasksRetry: bindNodetasksRetry(client),
  });
}

export function createFetchProvisioningMallsCreate(baseUrl: string): OperationMethod<"provisioning.malls.create"> {
  return bindMallsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMallsCreate(client: OperationExecutor): OperationMethod<"provisioning.malls.create"> {
  return bindOperation(client, defineContractOperation({"id":"provisioning.malls.create","method":"POST","path":"/api/v1/provisioning/malls","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchProvisioningMallsRead(baseUrl: string): OperationMethod<"provisioning.malls.read"> {
  return bindMallsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMallsRead(client: OperationExecutor): OperationMethod<"provisioning.malls.read"> {
  return bindOperation(client, defineContractOperation({"id":"provisioning.malls.read","method":"GET","path":"/api/v1/provisioning/malls/{mallid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchProvisioningNodetasksRead(baseUrl: string): OperationMethod<"provisioning.nodetasks.read"> {
  return bindNodetasksRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindNodetasksRead(client: OperationExecutor): OperationMethod<"provisioning.nodetasks.read"> {
  return bindOperation(client, defineContractOperation({"id":"provisioning.nodetasks.read","method":"GET","path":"/api/v1/provisioning/node-tasks/{taskid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchProvisioningNodetasksRetry(baseUrl: string): OperationMethod<"provisioning.nodetasks.retry"> {
  return bindNodetasksRetry(new ApiClient(baseUrl, new FetchTransport()));
}

function bindNodetasksRetry(client: OperationExecutor): OperationMethod<"provisioning.nodetasks.retry"> {
  return bindOperation(client, defineContractOperation({"id":"provisioning.nodetasks.retry","method":"POST","path":"/api/v1/provisioning/node-tasks/{taskid}/retry","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}
