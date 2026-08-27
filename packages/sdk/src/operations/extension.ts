// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const EXTENSION_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "extension.installations.read",
] as const satisfies readonly OperationId[]);

export interface ExtensionOperations {
  readonly installationsRead: OperationMethod<"extension.installations.read">;
}

export function createFetchExtension(baseUrl: string): ExtensionOperations {
  return createExtensionOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createExtensionOperations(client: OperationExecutor): ExtensionOperations {
  return Object.freeze({
    installationsRead: bindInstallationsRead(client),
  });
}

export function createFetchExtensionInstallationsRead(baseUrl: string): OperationMethod<"extension.installations.read"> {
  return bindInstallationsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindInstallationsRead(client: OperationExecutor): OperationMethod<"extension.installations.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"extension.installations.read","method":"GET","path":"/api/v1/extensions/installations","audience":"operator","idempotent":true,"pathKeys":[]}));
}
