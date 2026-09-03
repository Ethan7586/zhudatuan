// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const RUNTIME_OPERATION_IDS = Object.freeze([
  "runtime.health.live",
  "runtime.health.ready",
  "runtime.health.startup",
  "runtime.health.dependency",
] as const satisfies readonly OperationId[]);

export interface RuntimeOperations {
  readonly healthLive: OperationMethod<"runtime.health.live">;
  readonly healthReady: OperationMethod<"runtime.health.ready">;
  readonly healthStartup: OperationMethod<"runtime.health.startup">;
  readonly healthDependency: OperationMethod<"runtime.health.dependency">;
}

export function createFetchRuntime(baseUrl: string): RuntimeOperations { return createRuntimeOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createRuntimeOperations(client: OperationExecutor): RuntimeOperations { return Object.freeze({
    healthLive: bindHealthLive(client),
    healthReady: bindHealthReady(client),
    healthStartup: bindHealthStartup(client),
    healthDependency: bindHealthDependency(client),
  }); }

export function createFetchRuntimeHealthLive(baseUrl: string): OperationMethod<"runtime.health.live"> { return bindHealthLive(new ApiClient(baseUrl, new FetchTransport())); }

function bindHealthLive(client: OperationExecutor): OperationMethod<"runtime.health.live"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.health.live","method":"GET","path":"/health/live","audience":"system","targets":[],"responseMode":"json","idempotent":true,"timeout":300,"errorUnion":["AUTHORIZATION_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","RATE_LIMITED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("RuntimeHealthLiveInput", [] as const, false), output: exactOperationOutput("RuntimeHealthLiveOutput") })); }

export function createFetchRuntimeHealthReady(baseUrl: string): OperationMethod<"runtime.health.ready"> { return bindHealthReady(new ApiClient(baseUrl, new FetchTransport())); }

function bindHealthReady(client: OperationExecutor): OperationMethod<"runtime.health.ready"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.health.ready","method":"GET","path":"/health/ready","audience":"system","targets":[],"responseMode":"json","idempotent":true,"timeout":300,"errorUnion":["AUTHORIZATION_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","RATE_LIMITED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("RuntimeHealthReadyInput", [] as const, false), output: exactOperationOutput("RuntimeHealthReadyOutput") })); }

export function createFetchRuntimeHealthStartup(baseUrl: string): OperationMethod<"runtime.health.startup"> { return bindHealthStartup(new ApiClient(baseUrl, new FetchTransport())); }

function bindHealthStartup(client: OperationExecutor): OperationMethod<"runtime.health.startup"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.health.startup","method":"GET","path":"/health/startup","audience":"system","targets":[],"responseMode":"json","idempotent":true,"timeout":300,"errorUnion":["AUTHORIZATION_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","RATE_LIMITED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("RuntimeHealthStartupInput", [] as const, false), output: exactOperationOutput("RuntimeHealthStartupOutput") })); }

export function createFetchRuntimeHealthDependency(baseUrl: string): OperationMethod<"runtime.health.dependency"> { return bindHealthDependency(new ApiClient(baseUrl, new FetchTransport())); }

function bindHealthDependency(client: OperationExecutor): OperationMethod<"runtime.health.dependency"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.health.dependency","method":"GET","path":"/health/dependency","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":300,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("RuntimeHealthDependencyInput", [] as const, false), output: exactOperationOutput("RuntimeHealthDependencyOutput") })); }
