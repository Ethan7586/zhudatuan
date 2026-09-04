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
  "observability.healthoverview.read",
  "observability.slo.read",
] as const satisfies readonly OperationId[]);

export interface ObservabilityOperations {
  readonly clienterrorsCreate: OperationMethod<"observability.clienterrors.create">;
  readonly clienterrorsRead: OperationMethod<"observability.clienterrors.read">;
  readonly healthoverviewRead: OperationMethod<"observability.healthoverview.read">;
  readonly sloRead: OperationMethod<"observability.slo.read">;
}

export const OBSERVABILITY_METHOD_BY_OPERATION = Object.freeze({
  "observability.clienterrors.create": "clienterrorsCreate",
  "observability.clienterrors.read": "clienterrorsRead",
  "observability.healthoverview.read": "healthoverviewRead",
  "observability.slo.read": "sloRead",
} as const satisfies Readonly<Record<(typeof OBSERVABILITY_OPERATION_IDS)[number], keyof ObservabilityOperations>>);

export function createFetchObservability(baseUrl: string): ObservabilityOperations { return createObservabilityOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createObservabilityOperations(client: OperationExecutor): ObservabilityOperations { return Object.freeze({
    clienterrorsCreate: bindClienterrorsCreate(client),
    clienterrorsRead: bindClienterrorsRead(client),
    healthoverviewRead: bindHealthoverviewRead(client),
    sloRead: bindSloRead(client),
  }); }

export function createFetchObservabilityClienterrorsCreate(baseUrl: string): OperationMethod<"observability.clienterrors.create"> { return bindClienterrorsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindClienterrorsCreate(client: OperationExecutor): OperationMethod<"observability.clienterrors.create"> { return bindOperation(client, defineOperation({ ...{"id":"observability.clienterrors.create","method":"POST","path":"/api/v1/telemetry/clienterrors","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ObservabilityClienterrorsCreateInput", [] as const, true), output: exactOperationOutput("ObservabilityClienterrorsCreateOutput") })); }

export function createFetchObservabilityClienterrorsRead(baseUrl: string): OperationMethod<"observability.clienterrors.read"> { return bindClienterrorsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindClienterrorsRead(client: OperationExecutor): OperationMethod<"observability.clienterrors.read"> { return bindOperation(client, defineOperation({ ...{"id":"observability.clienterrors.read","method":"GET","path":"/api/v1/telemetry/clienterrors","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ObservabilityClienterrorsReadInput", [] as const, false), output: exactOperationOutput("ObservabilityClienterrorsReadOutput") })); }

export function createFetchObservabilityHealthoverviewRead(baseUrl: string): OperationMethod<"observability.healthoverview.read"> { return bindHealthoverviewRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindHealthoverviewRead(client: OperationExecutor): OperationMethod<"observability.healthoverview.read"> { return bindOperation(client, defineOperation({ ...{"id":"observability.healthoverview.read","method":"GET","path":"/api/v1/observability/health","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ObservabilityHealthoverviewReadInput", [] as const, false), output: exactOperationOutput("ObservabilityHealthoverviewReadOutput") })); }

export function createFetchObservabilitySloRead(baseUrl: string): OperationMethod<"observability.slo.read"> { return bindSloRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindSloRead(client: OperationExecutor): OperationMethod<"observability.slo.read"> { return bindOperation(client, defineOperation({ ...{"id":"observability.slo.read","method":"GET","path":"/api/v1/observability/slos","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ObservabilitySloReadInput", [] as const, false), output: exactOperationOutput("ObservabilitySloReadOutput") })); }
