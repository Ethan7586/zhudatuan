// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, defineOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const AUDIT_OPERATION_IDS = Object.freeze([
  "audit.records.read",
] as const satisfies readonly OperationId[]);

export interface AuditOperations {
  readonly recordsRead: OperationMethod<"audit.records.read">;
}

export function createFetchAudit(baseUrl: string): AuditOperations { return createAuditOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createAuditOperations(client: OperationExecutor): AuditOperations { return Object.freeze({
    recordsRead: bindRecordsRead(client),
  }); }

export function createFetchAuditRecordsRead(baseUrl: string): OperationMethod<"audit.records.read"> { return bindRecordsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindRecordsRead(client: OperationExecutor): OperationMethod<"audit.records.read"> { return bindOperation(client, defineOperation({"id":"audit.records.read","method":"GET","path":"/api/v1/audits","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }
