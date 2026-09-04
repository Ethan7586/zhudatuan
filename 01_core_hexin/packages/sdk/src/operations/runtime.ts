// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const RUNTIME_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
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

export function createFetchRuntime(baseUrl: string): RuntimeOperations {
  return createRuntimeOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createRuntimeOperations(client: OperationExecutor): RuntimeOperations {
  return Object.freeze({
    healthLive: bindHealthLive(client),
    healthReady: bindHealthReady(client),
    healthStartup: bindHealthStartup(client),
    healthDependency: bindHealthDependency(client),
  });
}

export function createFetchRuntimeHealthLive(baseUrl: string): OperationMethod<"runtime.health.live"> {
  return bindHealthLive(new ApiClient(baseUrl, new FetchTransport()));
}

function bindHealthLive(client: OperationExecutor): OperationMethod<"runtime.health.live"> {
  return bindOperation(client, defineStructuralOperation({"id":"runtime.health.live","method":"GET","path":"/health/live","audience":"public","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime","pathKeys":[]}));
}

export function createFetchRuntimeHealthReady(baseUrl: string): OperationMethod<"runtime.health.ready"> {
  return bindHealthReady(new ApiClient(baseUrl, new FetchTransport()));
}

function bindHealthReady(client: OperationExecutor): OperationMethod<"runtime.health.ready"> {
  return bindOperation(client, defineStructuralOperation({"id":"runtime.health.ready","method":"GET","path":"/health/ready","audience":"public","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime","pathKeys":[]}));
}

export function createFetchRuntimeHealthStartup(baseUrl: string): OperationMethod<"runtime.health.startup"> {
  return bindHealthStartup(new ApiClient(baseUrl, new FetchTransport()));
}

function bindHealthStartup(client: OperationExecutor): OperationMethod<"runtime.health.startup"> {
  return bindOperation(client, defineStructuralOperation({"id":"runtime.health.startup","method":"GET","path":"/health/startup","audience":"public","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime","pathKeys":[]}));
}

export function createFetchRuntimeHealthDependency(baseUrl: string): OperationMethod<"runtime.health.dependency"> {
  return bindHealthDependency(new ApiClient(baseUrl, new FetchTransport()));
}

function bindHealthDependency(client: OperationExecutor): OperationMethod<"runtime.health.dependency"> {
  return bindOperation(client, defineStructuralOperation({"id":"runtime.health.dependency","method":"GET","path":"/health/dependency","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime","pathKeys":[]}));
}
