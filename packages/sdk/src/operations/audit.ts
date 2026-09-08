// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const AUDIT_OPERATION_IDS = Object.freeze([
  "audit.records.read",
] as const satisfies readonly OperationId[]);

export interface AuditOperations {
  readonly recordsRead: OperationMethod<"audit.records.read">;
}

export const AUDIT_METHOD_BY_OPERATION = Object.freeze({
  "audit.records.read": "recordsRead",
} as const satisfies Readonly<Record<(typeof AUDIT_OPERATION_IDS)[number], keyof AuditOperations>>);

export function createFetchAudit(baseUrl: string): AuditOperations { return createAuditOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createAuditOperations(client: OperationExecutor): AuditOperations { return Object.freeze({
    recordsRead: bindRecordsRead(client),
  }); }

export function createFetchAuditRecordsRead(baseUrl: string): OperationMethod<"audit.records.read"> { return bindRecordsRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindRecordsRead(client: OperationExecutor): OperationMethod<"audit.records.read"> { return bindOperation(client, defineOperation({ ...{"id":"audit.records.read","method":"GET","path":"/api/v1/audits","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("AuditRecordsReadInput", [] as const, false), output: exactOperationOutput("AuditRecordsReadOutput") })); }
