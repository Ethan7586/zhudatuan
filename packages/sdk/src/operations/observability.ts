// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

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

function bindClienterrorsCreate(client: OperationExecutor): OperationMethod<"observability.clienterrors.create"> { return bindOperation(client, defineOperation({ ...{"id":"observability.clienterrors.create","method":"POST","path":"/api/v1/telemetry/clienterrors","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ObservabilityClienterrorsCreateInput", [] as const, true), output: exactOperationOutput("ObservabilityClienterrorsCreateOutput") })); }

export function createFetchObservabilityClienterrorsRead(baseUrl: string): OperationMethod<"observability.clienterrors.read"> { return bindClienterrorsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindClienterrorsRead(client: OperationExecutor): OperationMethod<"observability.clienterrors.read"> { return bindOperation(client, defineOperation({ ...{"id":"observability.clienterrors.read","method":"GET","path":"/api/v1/telemetry/clienterrors","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ObservabilityClienterrorsReadInput", [] as const, false), output: exactOperationOutput("ObservabilityClienterrorsReadOutput") })); }
