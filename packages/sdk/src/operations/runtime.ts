// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const RUNTIME_OPERATION_IDS = Object.freeze([
  "runtime.health.live",
  "runtime.health.ready",
  "runtime.health.startup",
  "runtime.health.dependency",
  "runtime.jobs.read",
  "runtime.jobs.cancel",
  "runtime.uploads.create",
  "runtime.imports.create",
  "runtime.imports.read",
  "runtime.imports.confirm",
  "runtime.imports.retry",
  "runtime.exports.read",
  "runtime.exports.cancel",
] as const satisfies readonly OperationId[]);

export interface RuntimeOperations {
  readonly healthLive: OperationMethod<"runtime.health.live">;
  readonly healthReady: OperationMethod<"runtime.health.ready">;
  readonly healthStartup: OperationMethod<"runtime.health.startup">;
  readonly healthDependency: OperationMethod<"runtime.health.dependency">;
  readonly jobsRead: OperationMethod<"runtime.jobs.read">;
  readonly jobsCancel: OperationMethod<"runtime.jobs.cancel">;
  readonly uploadsCreate: OperationMethod<"runtime.uploads.create">;
  readonly importsCreate: OperationMethod<"runtime.imports.create">;
  readonly importsRead: OperationMethod<"runtime.imports.read">;
  readonly importsConfirm: OperationMethod<"runtime.imports.confirm">;
  readonly importsRetry: OperationMethod<"runtime.imports.retry">;
  readonly exportsRead: OperationMethod<"runtime.exports.read">;
  readonly exportsCancel: OperationMethod<"runtime.exports.cancel">;
}

export const RUNTIME_METHOD_BY_OPERATION = Object.freeze({
  "runtime.health.live": "healthLive",
  "runtime.health.ready": "healthReady",
  "runtime.health.startup": "healthStartup",
  "runtime.health.dependency": "healthDependency",
  "runtime.jobs.read": "jobsRead",
  "runtime.jobs.cancel": "jobsCancel",
  "runtime.uploads.create": "uploadsCreate",
  "runtime.imports.create": "importsCreate",
  "runtime.imports.read": "importsRead",
  "runtime.imports.confirm": "importsConfirm",
  "runtime.imports.retry": "importsRetry",
  "runtime.exports.read": "exportsRead",
  "runtime.exports.cancel": "exportsCancel",
} as const satisfies Readonly<Record<(typeof RUNTIME_OPERATION_IDS)[number], keyof RuntimeOperations>>);

export function createFetchRuntime(baseUrl: string): RuntimeOperations { return createRuntimeOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createRuntimeOperations(client: OperationExecutor): RuntimeOperations { return Object.freeze({
    healthLive: bindHealthLive(client),
    healthReady: bindHealthReady(client),
    healthStartup: bindHealthStartup(client),
    healthDependency: bindHealthDependency(client),
    jobsRead: bindJobsRead(client),
    jobsCancel: bindJobsCancel(client),
    uploadsCreate: bindUploadsCreate(client),
    importsCreate: bindImportsCreate(client),
    importsRead: bindImportsRead(client),
    importsConfirm: bindImportsConfirm(client),
    importsRetry: bindImportsRetry(client),
    exportsRead: bindExportsRead(client),
    exportsCancel: bindExportsCancel(client),
  }); }

export function createFetchRuntimeHealthLive(baseUrl: string): OperationMethod<"runtime.health.live"> { return bindHealthLive(new ApiClient(baseUrl, new FetchTransport())); }

function bindHealthLive(client: OperationExecutor): OperationMethod<"runtime.health.live"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.health.live","method":"GET","path":"/health/live","audience":"system","targets":[],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":300,"errorUnion":["AUTHORIZATION_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","RATE_LIMITED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("RuntimeHealthLiveInput", [] as const, false), output: exactOperationOutput("RuntimeHealthLiveOutput") })); }

export function createFetchRuntimeHealthReady(baseUrl: string): OperationMethod<"runtime.health.ready"> { return bindHealthReady(new ApiClient(baseUrl, new FetchTransport())); }

function bindHealthReady(client: OperationExecutor): OperationMethod<"runtime.health.ready"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.health.ready","method":"GET","path":"/health/ready","audience":"system","targets":[],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":300,"errorUnion":["AUTHORIZATION_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","RATE_LIMITED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("RuntimeHealthReadyInput", [] as const, false), output: exactOperationOutput("RuntimeHealthReadyOutput") })); }

export function createFetchRuntimeHealthStartup(baseUrl: string): OperationMethod<"runtime.health.startup"> { return bindHealthStartup(new ApiClient(baseUrl, new FetchTransport())); }

function bindHealthStartup(client: OperationExecutor): OperationMethod<"runtime.health.startup"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.health.startup","method":"GET","path":"/health/startup","audience":"system","targets":[],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":300,"errorUnion":["AUTHORIZATION_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","RATE_LIMITED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("RuntimeHealthStartupInput", [] as const, false), output: exactOperationOutput("RuntimeHealthStartupOutput") })); }

export function createFetchRuntimeHealthDependency(baseUrl: string): OperationMethod<"runtime.health.dependency"> { return bindHealthDependency(new ApiClient(baseUrl, new FetchTransport())); }

function bindHealthDependency(client: OperationExecutor): OperationMethod<"runtime.health.dependency"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.health.dependency","method":"GET","path":"/health/dependency","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":300,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("RuntimeHealthDependencyInput", [] as const, false), output: exactOperationOutput("RuntimeHealthDependencyOutput") })); }

export function createFetchRuntimeJobsRead(baseUrl: string): OperationMethod<"runtime.jobs.read"> { return bindJobsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindJobsRead(client: OperationExecutor): OperationMethod<"runtime.jobs.read"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.jobs.read","method":"GET","path":"/api/v1/runtime/jobs","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("RuntimeJobsReadInput", [] as const, false), output: exactOperationOutput("RuntimeJobsReadOutput") })); }

export function createFetchRuntimeJobsCancel(baseUrl: string): OperationMethod<"runtime.jobs.cancel"> { return bindJobsCancel(new ApiClient(baseUrl, new FetchTransport())); }

function bindJobsCancel(client: OperationExecutor): OperationMethod<"runtime.jobs.cancel"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.jobs.cancel","method":"POST","path":"/api/v1/runtime/jobs/{jobid}/cancel","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("RuntimeJobsCancelInput", ["jobid"] as const, true), output: exactOperationOutput("RuntimeJobsCancelOutput") })); }

export function createFetchRuntimeUploadsCreate(baseUrl: string): OperationMethod<"runtime.uploads.create"> { return bindUploadsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindUploadsCreate(client: OperationExecutor): OperationMethod<"runtime.uploads.create"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.uploads.create","method":"POST","path":"/api/v1/runtime/uploads","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":1000,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("RuntimeUploadsCreateInput", [] as const, true), output: exactOperationOutput("RuntimeUploadsCreateOutput") })); }

export function createFetchRuntimeImportsCreate(baseUrl: string): OperationMethod<"runtime.imports.create"> { return bindImportsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsCreate(client: OperationExecutor): OperationMethod<"runtime.imports.create"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.imports.create","method":"POST","path":"/api/v1/runtime/imports","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("RuntimeImportsCreateInput", [] as const, true), output: exactOperationOutput("RuntimeImportsCreateOutput") })); }

export function createFetchRuntimeImportsRead(baseUrl: string): OperationMethod<"runtime.imports.read"> { return bindImportsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsRead(client: OperationExecutor): OperationMethod<"runtime.imports.read"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.imports.read","method":"GET","path":"/api/v1/runtime/imports/{importid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("RuntimeImportsReadInput", ["importid"] as const, false), output: exactOperationOutput("RuntimeImportsReadOutput") })); }

export function createFetchRuntimeImportsConfirm(baseUrl: string): OperationMethod<"runtime.imports.confirm"> { return bindImportsConfirm(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsConfirm(client: OperationExecutor): OperationMethod<"runtime.imports.confirm"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.imports.confirm","method":"POST","path":"/api/v1/runtime/imports/{importid}/confirm","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("RuntimeImportsConfirmInput", ["importid"] as const, true), output: exactOperationOutput("RuntimeImportsConfirmOutput") })); }

export function createFetchRuntimeImportsRetry(baseUrl: string): OperationMethod<"runtime.imports.retry"> { return bindImportsRetry(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsRetry(client: OperationExecutor): OperationMethod<"runtime.imports.retry"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.imports.retry","method":"POST","path":"/api/v1/runtime/imports/{importid}/retry","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("RuntimeImportsRetryInput", ["importid"] as const, true), output: exactOperationOutput("RuntimeImportsRetryOutput") })); }

export function createFetchRuntimeExportsRead(baseUrl: string): OperationMethod<"runtime.exports.read"> { return bindExportsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindExportsRead(client: OperationExecutor): OperationMethod<"runtime.exports.read"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.exports.read","method":"GET","path":"/api/v1/runtime/exports/{exportid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("RuntimeExportsReadInput", ["exportid"] as const, false), output: exactOperationOutput("RuntimeExportsReadOutput") })); }

export function createFetchRuntimeExportsCancel(baseUrl: string): OperationMethod<"runtime.exports.cancel"> { return bindExportsCancel(new ApiClient(baseUrl, new FetchTransport())); }

function bindExportsCancel(client: OperationExecutor): OperationMethod<"runtime.exports.cancel"> { return bindOperation(client, defineOperation({ ...{"id":"runtime.exports.cancel","method":"POST","path":"/api/v1/runtime/exports/{exportid}/cancel","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("RuntimeExportsCancelInput", ["exportid"] as const, true), output: exactOperationOutput("RuntimeExportsCancelOutput") })); }
