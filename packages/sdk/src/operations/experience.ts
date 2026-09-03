// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const EXPERIENCE_OPERATION_IDS = Object.freeze([
  "experience.applications.create",
  "experience.applications.copy",
  "experience.applications.detail.read",
  "experience.applications.read",
  "experience.applications.update",
  "experience.versions.save",
  "experience.versions.validate",
  "experience.versions.publish",
  "experience.versions.restore",
] as const satisfies readonly OperationId[]);

export interface ExperienceOperations {
  readonly applicationsCreate: OperationMethod<"experience.applications.create">;
  readonly applicationsCopy: OperationMethod<"experience.applications.copy">;
  readonly applicationsDetailRead: OperationMethod<"experience.applications.detail.read">;
  readonly applicationsRead: OperationMethod<"experience.applications.read">;
  readonly applicationsUpdate: OperationMethod<"experience.applications.update">;
  readonly versionsSave: OperationMethod<"experience.versions.save">;
  readonly versionsValidate: OperationMethod<"experience.versions.validate">;
  readonly versionsPublish: OperationMethod<"experience.versions.publish">;
  readonly versionsRestore: OperationMethod<"experience.versions.restore">;
}

export function createFetchExperience(baseUrl: string): ExperienceOperations { return createExperienceOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createExperienceOperations(client: OperationExecutor): ExperienceOperations { return Object.freeze({
    applicationsCreate: bindApplicationsCreate(client),
    applicationsCopy: bindApplicationsCopy(client),
    applicationsDetailRead: bindApplicationsDetailRead(client),
    applicationsRead: bindApplicationsRead(client),
    applicationsUpdate: bindApplicationsUpdate(client),
    versionsSave: bindVersionsSave(client),
    versionsValidate: bindVersionsValidate(client),
    versionsPublish: bindVersionsPublish(client),
    versionsRestore: bindVersionsRestore(client),
  }); }

export function createFetchExperienceApplicationsCreate(baseUrl: string): OperationMethod<"experience.applications.create"> { return bindApplicationsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindApplicationsCreate(client: OperationExecutor): OperationMethod<"experience.applications.create"> { return bindOperation(client, defineOperation({ ...{"id":"experience.applications.create","method":"POST","path":"/api/v1/experiences/applications","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPERIENCE_PUBLICATION_INVALID","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ExperienceApplicationsCreateInput", [] as const, true), output: exactOperationOutput("ExperienceApplicationsCreateOutput") })); }

export function createFetchExperienceApplicationsCopy(baseUrl: string): OperationMethod<"experience.applications.copy"> { return bindApplicationsCopy(new ApiClient(baseUrl, new FetchTransport())); }

function bindApplicationsCopy(client: OperationExecutor): OperationMethod<"experience.applications.copy"> { return bindOperation(client, defineOperation({ ...{"id":"experience.applications.copy","method":"POST","path":"/api/v1/experiences/applications/{applicationid}/copies","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPERIENCE_PUBLICATION_INVALID","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ExperienceApplicationsCopyInput", ["applicationid"] as const, true), output: exactOperationOutput("ExperienceApplicationsCopyOutput") })); }

export function createFetchExperienceApplicationsDetailRead(baseUrl: string): OperationMethod<"experience.applications.detail.read"> { return bindApplicationsDetailRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindApplicationsDetailRead(client: OperationExecutor): OperationMethod<"experience.applications.detail.read"> { return bindOperation(client, defineOperation({ ...{"id":"experience.applications.detail.read","method":"GET","path":"/api/v1/experiences/applications/{applicationid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","RESOURCE_NOT_FOUND","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ExperienceApplicationDetailReadInput", ["applicationid"] as const, false), output: exactOperationOutput("ExperienceApplicationDetailReadOutput") })); }

export function createFetchExperienceApplicationsRead(baseUrl: string): OperationMethod<"experience.applications.read"> { return bindApplicationsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindApplicationsRead(client: OperationExecutor): OperationMethod<"experience.applications.read"> { return bindOperation(client, defineOperation({ ...{"id":"experience.applications.read","method":"GET","path":"/api/v1/experiences/applications","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","EXPERIENCE_PUBLICATION_INVALID","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ExperienceApplicationsReadInput", [] as const, false), output: exactOperationOutput("ExperienceApplicationsReadOutput") })); }

export function createFetchExperienceApplicationsUpdate(baseUrl: string): OperationMethod<"experience.applications.update"> { return bindApplicationsUpdate(new ApiClient(baseUrl, new FetchTransport())); }

function bindApplicationsUpdate(client: OperationExecutor): OperationMethod<"experience.applications.update"> { return bindOperation(client, defineOperation({ ...{"id":"experience.applications.update","method":"PATCH","path":"/api/v1/experiences/applications/{applicationid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","EXPERIENCE_PUBLICATION_INVALID","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ExperienceApplicationsUpdateInput", ["applicationid"] as const, true), output: exactOperationOutput("ExperienceApplicationsUpdateOutput") })); }

export function createFetchExperienceVersionsSave(baseUrl: string): OperationMethod<"experience.versions.save"> { return bindVersionsSave(new ApiClient(baseUrl, new FetchTransport())); }

function bindVersionsSave(client: OperationExecutor): OperationMethod<"experience.versions.save"> { return bindOperation(client, defineOperation({ ...{"id":"experience.versions.save","method":"POST","path":"/api/v1/experiences/applications/{applicationid}/versions","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPERIENCE_PUBLICATION_INVALID","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ExperienceVersionsSaveInput", ["applicationid"] as const, true), output: exactOperationOutput("ExperienceVersionsSaveOutput") })); }

export function createFetchExperienceVersionsValidate(baseUrl: string): OperationMethod<"experience.versions.validate"> { return bindVersionsValidate(new ApiClient(baseUrl, new FetchTransport())); }

function bindVersionsValidate(client: OperationExecutor): OperationMethod<"experience.versions.validate"> { return bindOperation(client, defineOperation({ ...{"id":"experience.versions.validate","method":"POST","path":"/api/v1/experiences/versions/{versionid}/validation","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPERIENCE_PUBLICATION_INVALID","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ExperienceVersionsValidateInput", ["versionid"] as const, true), output: exactOperationOutput("ExperienceVersionsValidateOutput") })); }

export function createFetchExperienceVersionsPublish(baseUrl: string): OperationMethod<"experience.versions.publish"> { return bindVersionsPublish(new ApiClient(baseUrl, new FetchTransport())); }

function bindVersionsPublish(client: OperationExecutor): OperationMethod<"experience.versions.publish"> { return bindOperation(client, defineOperation({ ...{"id":"experience.versions.publish","method":"PUT","path":"/api/v1/experiences/versions/{versionid}/publication","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","EXPERIENCE_PUBLICATION_INVALID","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ExperienceVersionsPublishInput", ["versionid"] as const, true), output: exactOperationOutput("ExperienceVersionsPublishOutput") })); }

export function createFetchExperienceVersionsRestore(baseUrl: string): OperationMethod<"experience.versions.restore"> { return bindVersionsRestore(new ApiClient(baseUrl, new FetchTransport())); }

function bindVersionsRestore(client: OperationExecutor): OperationMethod<"experience.versions.restore"> { return bindOperation(client, defineOperation({ ...{"id":"experience.versions.restore","method":"POST","path":"/api/v1/experiences/versions/{versionid}/restorations","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPERIENCE_PUBLICATION_INVALID","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ExperienceVersionsRestoreInput", ["versionid"] as const, true), output: exactOperationOutput("ExperienceVersionsRestoreOutput") })); }
