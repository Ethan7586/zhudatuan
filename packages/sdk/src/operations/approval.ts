// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const APPROVAL_OPERATION_IDS = Object.freeze([
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

export const APPROVAL_METHOD_BY_OPERATION = Object.freeze({
  "approval.templates.create": "templatesCreate",
  "approval.templates.revise": "templatesRevise",
  "approval.templates.enable": "templatesEnable",
  "approval.templates.disable": "templatesDisable",
  "approval.templates.get": "templatesGet",
  "approval.templates.list": "templatesList",
  "approval.tasks.list": "tasksList",
  "approval.tasks.approve": "tasksApprove",
  "approval.tasks.reject": "tasksReject",
  "approval.instances.get": "instancesGet",
} as const satisfies Readonly<Record<(typeof APPROVAL_OPERATION_IDS)[number], keyof ApprovalOperations>>);

export function createFetchApproval(baseUrl: string): ApprovalOperations { return createApprovalOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createApprovalOperations(client: OperationExecutor): ApprovalOperations { return Object.freeze({
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
  }); }

export function createFetchApprovalTemplatesCreate(baseUrl: string): OperationMethod<"approval.templates.create"> { return bindTemplatesCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindTemplatesCreate(client: OperationExecutor): OperationMethod<"approval.templates.create"> { return bindOperation(client, defineOperation({ ...{"id":"approval.templates.create","method":"POST","path":"/api/v1/approvals/templates","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["APPROVAL_TEMPLATE_CODE_CONFLICT","APPROVAL_TEMPLATE_VERSION_CONFLICT","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ApprovalTemplatesCreateInput", [] as const, true), output: exactOperationOutput("ApprovalTemplatesCreateOutput") })); }

export function createFetchApprovalTemplatesRevise(baseUrl: string): OperationMethod<"approval.templates.revise"> { return bindTemplatesRevise(new ApiClient(baseUrl, new FetchTransport())); }

function bindTemplatesRevise(client: OperationExecutor): OperationMethod<"approval.templates.revise"> { return bindOperation(client, defineOperation({ ...{"id":"approval.templates.revise","method":"POST","path":"/api/v1/approvals/templates/{templateid}/versions","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["APPROVAL_TEMPLATE_VERSION_CONFLICT","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ApprovalTemplatesReviseInput", ["templateid"] as const, true), output: exactOperationOutput("ApprovalTemplatesReviseOutput") })); }

export function createFetchApprovalTemplatesEnable(baseUrl: string): OperationMethod<"approval.templates.enable"> { return bindTemplatesEnable(new ApiClient(baseUrl, new FetchTransport())); }

function bindTemplatesEnable(client: OperationExecutor): OperationMethod<"approval.templates.enable"> { return bindOperation(client, defineOperation({ ...{"id":"approval.templates.enable","method":"POST","path":"/api/v1/approvals/templates/{templateid}/enablement","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["APPROVAL_TEMPLATE_ACTIVE_CONFLICT","APPROVAL_TEMPLATE_VERSION_CONFLICT","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ApprovalTemplatesEnableInput", ["templateid"] as const, true), output: exactOperationOutput("ApprovalTemplatesEnableOutput") })); }

export function createFetchApprovalTemplatesDisable(baseUrl: string): OperationMethod<"approval.templates.disable"> { return bindTemplatesDisable(new ApiClient(baseUrl, new FetchTransport())); }

function bindTemplatesDisable(client: OperationExecutor): OperationMethod<"approval.templates.disable"> { return bindOperation(client, defineOperation({ ...{"id":"approval.templates.disable","method":"DELETE","path":"/api/v1/approvals/templates/{templateid}/enablement","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["APPROVAL_TEMPLATE_VERSION_CONFLICT","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ApprovalTemplatesDisableInput", ["templateid"] as const, true), output: exactOperationOutput("ApprovalTemplatesDisableOutput") })); }

export function createFetchApprovalTemplatesGet(baseUrl: string): OperationMethod<"approval.templates.get"> { return bindTemplatesGet(new ApiClient(baseUrl, new FetchTransport())); }

function bindTemplatesGet(client: OperationExecutor): OperationMethod<"approval.templates.get"> { return bindOperation(client, defineOperation({ ...{"id":"approval.templates.get","method":"GET","path":"/api/v1/approvals/templates/{templateid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ApprovalTemplatesGetInput", ["templateid"] as const, false), output: exactOperationOutput("ApprovalTemplatesGetOutput") })); }

export function createFetchApprovalTemplatesList(baseUrl: string): OperationMethod<"approval.templates.list"> { return bindTemplatesList(new ApiClient(baseUrl, new FetchTransport())); }

function bindTemplatesList(client: OperationExecutor): OperationMethod<"approval.templates.list"> { return bindOperation(client, defineOperation({ ...{"id":"approval.templates.list","method":"GET","path":"/api/v1/approvals/templates","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ApprovalTemplatesListInput", [] as const, false), output: exactOperationOutput("ApprovalTemplatesListOutput") })); }

export function createFetchApprovalTasksList(baseUrl: string): OperationMethod<"approval.tasks.list"> { return bindTasksList(new ApiClient(baseUrl, new FetchTransport())); }

function bindTasksList(client: OperationExecutor): OperationMethod<"approval.tasks.list"> { return bindOperation(client, defineOperation({ ...{"id":"approval.tasks.list","method":"GET","path":"/api/v1/approvals/tasks","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ApprovalTasksListInput", [] as const, false), output: exactOperationOutput("ApprovalTasksListOutput") })); }

export function createFetchApprovalTasksApprove(baseUrl: string): OperationMethod<"approval.tasks.approve"> { return bindTasksApprove(new ApiClient(baseUrl, new FetchTransport())); }

function bindTasksApprove(client: OperationExecutor): OperationMethod<"approval.tasks.approve"> { return bindOperation(client, defineOperation({ ...{"id":"approval.tasks.approve","method":"POST","path":"/api/v1/approvals/tasks/{taskid}/approval","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["APPROVAL_ALREADY_DECIDED","APPROVAL_INSTANCE_EXPIRED","APPROVAL_NOT_ASSIGNED","APPROVAL_SELF_DECISION_FORBIDDEN","APPROVAL_TASK_CONFLICT","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ApprovalTasksApproveInput", ["taskid"] as const, true), output: exactOperationOutput("ApprovalTasksApproveOutput") })); }

export function createFetchApprovalTasksReject(baseUrl: string): OperationMethod<"approval.tasks.reject"> { return bindTasksReject(new ApiClient(baseUrl, new FetchTransport())); }

function bindTasksReject(client: OperationExecutor): OperationMethod<"approval.tasks.reject"> { return bindOperation(client, defineOperation({ ...{"id":"approval.tasks.reject","method":"POST","path":"/api/v1/approvals/tasks/{taskid}/rejection","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["APPROVAL_ALREADY_DECIDED","APPROVAL_INSTANCE_EXPIRED","APPROVAL_NOT_ASSIGNED","APPROVAL_SELF_DECISION_FORBIDDEN","APPROVAL_TASK_CONFLICT","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ApprovalTasksRejectInput", ["taskid"] as const, true), output: exactOperationOutput("ApprovalTasksRejectOutput") })); }

export function createFetchApprovalInstancesGet(baseUrl: string): OperationMethod<"approval.instances.get"> { return bindInstancesGet(new ApiClient(baseUrl, new FetchTransport())); }

function bindInstancesGet(client: OperationExecutor): OperationMethod<"approval.instances.get"> { return bindOperation(client, defineOperation({ ...{"id":"approval.instances.get","method":"GET","path":"/api/v1/approvals/instances/{instanceid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ApprovalInstancesGetInput", ["instanceid"] as const, false), output: exactOperationOutput("ApprovalInstancesGetOutput") })); }
