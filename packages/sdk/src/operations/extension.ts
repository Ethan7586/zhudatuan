// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const EXTENSION_OPERATION_IDS = Object.freeze([
  "extension.installations.read",
] as const satisfies readonly OperationId[]);

export interface ExtensionOperations {
  readonly installationsRead: OperationMethod<"extension.installations.read">;
}

export const EXTENSION_METHOD_BY_OPERATION = Object.freeze({
  "extension.installations.read": "installationsRead",
} as const satisfies Readonly<Record<(typeof EXTENSION_OPERATION_IDS)[number], keyof ExtensionOperations>>);

export function createFetchExtension(baseUrl: string): ExtensionOperations { return createExtensionOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createExtensionOperations(client: OperationExecutor): ExtensionOperations { return Object.freeze({
    installationsRead: bindInstallationsRead(client),
  }); }

export function createFetchExtensionInstallationsRead(baseUrl: string): OperationMethod<"extension.installations.read"> { return bindInstallationsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindInstallationsRead(client: OperationExecutor): OperationMethod<"extension.installations.read"> { return bindOperation(client, defineOperation({ ...{"id":"extension.installations.read","method":"GET","path":"/api/v1/extensions/installations","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ExtensionInstallationsReadInput", [] as const, false), output: exactOperationOutput("ExtensionInstallationsReadOutput") })); }
