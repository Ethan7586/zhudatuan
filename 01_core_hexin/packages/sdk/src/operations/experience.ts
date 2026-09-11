// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const EXPERIENCE_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "experience.applications.create",
  "experience.published.read",
  "experience.applications.copy",
  "experience.applications.read",
  "experience.applications.update",
  "experience.versions.save",
  "experience.versions.validate",
  "experience.versions.publish",
  "experience.versions.restore",
] as const satisfies readonly OperationId[]);

export interface ExperienceOperations {
  readonly applicationsCreate: OperationMethod<"experience.applications.create">;
  readonly publishedRead: OperationMethod<"experience.published.read">;
  readonly applicationsCopy: OperationMethod<"experience.applications.copy">;
  readonly applicationsRead: OperationMethod<"experience.applications.read">;
  readonly applicationsUpdate: OperationMethod<"experience.applications.update">;
  readonly versionsSave: OperationMethod<"experience.versions.save">;
  readonly versionsValidate: OperationMethod<"experience.versions.validate">;
  readonly versionsPublish: OperationMethod<"experience.versions.publish">;
  readonly versionsRestore: OperationMethod<"experience.versions.restore">;
}

export function createFetchExperience(baseUrl: string): ExperienceOperations {
  return createExperienceOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createExperienceOperations(client: OperationExecutor): ExperienceOperations {
  return Object.freeze({
    applicationsCreate: bindApplicationsCreate(client),
    publishedRead: bindPublishedRead(client),
    applicationsCopy: bindApplicationsCopy(client),
    applicationsRead: bindApplicationsRead(client),
    applicationsUpdate: bindApplicationsUpdate(client),
    versionsSave: bindVersionsSave(client),
    versionsValidate: bindVersionsValidate(client),
    versionsPublish: bindVersionsPublish(client),
    versionsRestore: bindVersionsRestore(client),
  });
}

export function createFetchExperienceApplicationsCreate(baseUrl: string): OperationMethod<"experience.applications.create"> {
  return bindApplicationsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindApplicationsCreate(client: OperationExecutor): OperationMethod<"experience.applications.create"> {
  return bindOperation(client, defineContractOperation({"id":"experience.applications.create","method":"POST","path":"/api/v1/experiences/applications","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchExperiencePublishedRead(baseUrl: string): OperationMethod<"experience.published.read"> {
  return bindPublishedRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPublishedRead(client: OperationExecutor): OperationMethod<"experience.published.read"> {
  return bindOperation(client, defineContractOperation({"id":"experience.published.read","method":"GET","path":"/api/v1/experiences/published","audience":"public","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchExperienceApplicationsCopy(baseUrl: string): OperationMethod<"experience.applications.copy"> {
  return bindApplicationsCopy(new ApiClient(baseUrl, new FetchTransport()));
}

function bindApplicationsCopy(client: OperationExecutor): OperationMethod<"experience.applications.copy"> {
  return bindOperation(client, defineContractOperation({"id":"experience.applications.copy","method":"POST","path":"/api/v1/experiences/applications/{applicationid}/copies","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchExperienceApplicationsRead(baseUrl: string): OperationMethod<"experience.applications.read"> {
  return bindApplicationsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindApplicationsRead(client: OperationExecutor): OperationMethod<"experience.applications.read"> {
  return bindOperation(client, defineContractOperation({"id":"experience.applications.read","method":"GET","path":"/api/v1/experiences/applications","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchExperienceApplicationsUpdate(baseUrl: string): OperationMethod<"experience.applications.update"> {
  return bindApplicationsUpdate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindApplicationsUpdate(client: OperationExecutor): OperationMethod<"experience.applications.update"> {
  return bindOperation(client, defineContractOperation({"id":"experience.applications.update","method":"PATCH","path":"/api/v1/experiences/applications/{applicationid}","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchExperienceVersionsSave(baseUrl: string): OperationMethod<"experience.versions.save"> {
  return bindVersionsSave(new ApiClient(baseUrl, new FetchTransport()));
}

function bindVersionsSave(client: OperationExecutor): OperationMethod<"experience.versions.save"> {
  return bindOperation(client, defineContractOperation({"id":"experience.versions.save","method":"POST","path":"/api/v1/experiences/applications/{applicationid}/versions","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchExperienceVersionsValidate(baseUrl: string): OperationMethod<"experience.versions.validate"> {
  return bindVersionsValidate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindVersionsValidate(client: OperationExecutor): OperationMethod<"experience.versions.validate"> {
  return bindOperation(client, defineContractOperation({"id":"experience.versions.validate","method":"POST","path":"/api/v1/experiences/versions/{versionid}/validation","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchExperienceVersionsPublish(baseUrl: string): OperationMethod<"experience.versions.publish"> {
  return bindVersionsPublish(new ApiClient(baseUrl, new FetchTransport()));
}

function bindVersionsPublish(client: OperationExecutor): OperationMethod<"experience.versions.publish"> {
  return bindOperation(client, defineContractOperation({"id":"experience.versions.publish","method":"PUT","path":"/api/v1/experiences/versions/{versionid}/publication","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchExperienceVersionsRestore(baseUrl: string): OperationMethod<"experience.versions.restore"> {
  return bindVersionsRestore(new ApiClient(baseUrl, new FetchTransport()));
}

function bindVersionsRestore(client: OperationExecutor): OperationMethod<"experience.versions.restore"> {
  return bindOperation(client, defineContractOperation({"id":"experience.versions.restore","method":"POST","path":"/api/v1/experiences/versions/{versionid}/restorations","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}
