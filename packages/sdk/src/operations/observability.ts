// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const OBSERVABILITY_OPERATION_IDS = Object.freeze([
  "observability.clienterrors.create",
  "observability.clienterrors.read",
] as const satisfies readonly OperationId[]);

export interface ObservabilityOperations {
  readonly clienterrorsCreate: OperationMethod<"observability.clienterrors.create">;
  readonly clienterrorsRead: OperationMethod<"observability.clienterrors.read">;
}

export function createFetchObservability(baseUrl: string): ObservabilityOperations { return createObservabilityOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createObservabilityOperations(client: OperationExecutor): ObservabilityOperations { return Object.freeze({
    clienterrorsCreate: bindClienterrorsCreate(client),
    clienterrorsRead: bindClienterrorsRead(client),
  }); }

export function createFetchObservabilityClienterrorsCreate(baseUrl: string): OperationMethod<"observability.clienterrors.create"> { return bindClienterrorsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindClienterrorsCreate(client: OperationExecutor): OperationMethod<"observability.clienterrors.create"> { return bindOperation(client, defineOperation({"id":"observability.clienterrors.create","method":"POST","path":"/api/v1/telemetry/clienterrors","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchObservabilityClienterrorsRead(baseUrl: string): OperationMethod<"observability.clienterrors.read"> { return bindClienterrorsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindClienterrorsRead(client: OperationExecutor): OperationMethod<"observability.clienterrors.read"> { return bindOperation(client, defineOperation({"id":"observability.clienterrors.read","method":"GET","path":"/api/v1/telemetry/clienterrors","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }
