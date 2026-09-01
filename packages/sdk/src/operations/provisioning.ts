// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const PROVISIONING_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "provisioning.malls.create",
] as const satisfies readonly OperationId[]);

export interface ProvisioningOperations {
  readonly mallsCreate: OperationMethod<"provisioning.malls.create">;
}

export function createFetchProvisioning(baseUrl: string): ProvisioningOperations {
  return createProvisioningOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createProvisioningOperations(client: OperationExecutor): ProvisioningOperations {
  return Object.freeze({
    mallsCreate: bindMallsCreate(client),
  });
}

export function createFetchProvisioningMallsCreate(baseUrl: string): OperationMethod<"provisioning.malls.create"> {
  return bindMallsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMallsCreate(client: OperationExecutor): OperationMethod<"provisioning.malls.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"provisioning.malls.create","method":"POST","path":"/api/v1/provisioning/malls","audience":"operator","idempotent":false,"pathKeys":[]}));
}
