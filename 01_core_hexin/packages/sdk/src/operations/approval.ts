// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const APPROVAL_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "approval.templates.create",
  "approval.templates.revise",
  "approval.templates.enable",
  "approval.templates.disable",
  "approval.templates.get",
  "approval.templates.list",
  "approval.tasks.list",
  "approval.tasks.approve",
  "approval.tasks.reject",
  "approval.instances.get",
] as const satisfies readonly OperationId[]);

export interface ApprovalOperations {
  readonly templatesCreate: OperationMethod<"approval.templates.create">;
  readonly templatesRevise: OperationMethod<"approval.templates.revise">;
  readonly templatesEnable: OperationMethod<"approval.templates.enable">;
  readonly templatesDisable: OperationMethod<"approval.templates.disable">;
  readonly templatesGet: OperationMethod<"approval.templates.get">;
  readonly templatesList: OperationMethod<"approval.templates.list">;
  readonly tasksList: OperationMethod<"approval.tasks.list">;
  readonly tasksApprove: OperationMethod<"approval.tasks.approve">;
  readonly tasksReject: OperationMethod<"approval.tasks.reject">;
  readonly instancesGet: OperationMethod<"approval.instances.get">;
}

export function createFetchApproval(baseUrl: string): ApprovalOperations {
  return createApprovalOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createApprovalOperations(client: OperationExecutor): ApprovalOperations {
  return Object.freeze({
    templatesCreate: bindTemplatesCreate(client),
    templatesRevise: bindTemplatesRevise(client),
    templatesEnable: bindTemplatesEnable(client),
    templatesDisable: bindTemplatesDisable(client),
    templatesGet: bindTemplatesGet(client),
    templatesList: bindTemplatesList(client),
    tasksList: bindTasksList(client),
    tasksApprove: bindTasksApprove(client),
    tasksReject: bindTasksReject(client),
    instancesGet: bindInstancesGet(client),
  });
}

export function createFetchApprovalTemplatesCreate(baseUrl: string): OperationMethod<"approval.templates.create"> {
  return bindTemplatesCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTemplatesCreate(client: OperationExecutor): OperationMethod<"approval.templates.create"> {
  return bindOperation(client, defineContractOperation({"id":"approval.templates.create","method":"POST","path":"/api/v1/approvals/templates","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchApprovalTemplatesRevise(baseUrl: string): OperationMethod<"approval.templates.revise"> {
  return bindTemplatesRevise(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTemplatesRevise(client: OperationExecutor): OperationMethod<"approval.templates.revise"> {
  return bindOperation(client, defineContractOperation({"id":"approval.templates.revise","method":"POST","path":"/api/v1/approvals/templates/{templateid}/versions","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchApprovalTemplatesEnable(baseUrl: string): OperationMethod<"approval.templates.enable"> {
  return bindTemplatesEnable(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTemplatesEnable(client: OperationExecutor): OperationMethod<"approval.templates.enable"> {
  return bindOperation(client, defineContractOperation({"id":"approval.templates.enable","method":"POST","path":"/api/v1/approvals/templates/{templateid}/enable","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchApprovalTemplatesDisable(baseUrl: string): OperationMethod<"approval.templates.disable"> {
  return bindTemplatesDisable(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTemplatesDisable(client: OperationExecutor): OperationMethod<"approval.templates.disable"> {
  return bindOperation(client, defineContractOperation({"id":"approval.templates.disable","method":"POST","path":"/api/v1/approvals/templates/{templateid}/disable","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchApprovalTemplatesGet(baseUrl: string): OperationMethod<"approval.templates.get"> {
  return bindTemplatesGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTemplatesGet(client: OperationExecutor): OperationMethod<"approval.templates.get"> {
  return bindOperation(client, defineContractOperation({"id":"approval.templates.get","method":"GET","path":"/api/v1/approvals/templates/{templateid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchApprovalTemplatesList(baseUrl: string): OperationMethod<"approval.templates.list"> {
  return bindTemplatesList(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTemplatesList(client: OperationExecutor): OperationMethod<"approval.templates.list"> {
  return bindOperation(client, defineContractOperation({"id":"approval.templates.list","method":"GET","path":"/api/v1/approvals/templates","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchApprovalTasksList(baseUrl: string): OperationMethod<"approval.tasks.list"> {
  return bindTasksList(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTasksList(client: OperationExecutor): OperationMethod<"approval.tasks.list"> {
  return bindOperation(client, defineContractOperation({"id":"approval.tasks.list","method":"GET","path":"/api/v1/approvals/tasks","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchApprovalTasksApprove(baseUrl: string): OperationMethod<"approval.tasks.approve"> {
  return bindTasksApprove(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTasksApprove(client: OperationExecutor): OperationMethod<"approval.tasks.approve"> {
  return bindOperation(client, defineContractOperation({"id":"approval.tasks.approve","method":"POST","path":"/api/v1/approvals/tasks/{taskid}/approve","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchApprovalTasksReject(baseUrl: string): OperationMethod<"approval.tasks.reject"> {
  return bindTasksReject(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTasksReject(client: OperationExecutor): OperationMethod<"approval.tasks.reject"> {
  return bindOperation(client, defineContractOperation({"id":"approval.tasks.reject","method":"POST","path":"/api/v1/approvals/tasks/{taskid}/reject","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchApprovalInstancesGet(baseUrl: string): OperationMethod<"approval.instances.get"> {
  return bindInstancesGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindInstancesGet(client: OperationExecutor): OperationMethod<"approval.instances.get"> {
  return bindOperation(client, defineContractOperation({"id":"approval.instances.get","method":"GET","path":"/api/v1/approvals/instances/{instanceid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}
