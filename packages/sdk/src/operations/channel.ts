// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const CHANNEL_OPERATION_IDS = Object.freeze([
  "channel.distributors.create",
  "channel.distributors.read",
  "channel.distributors.update",
  "channel.distributors.disable",
  "channel.bindings.manage",
  "channel.quotas.manage",
  "channel.connections.read",
  "channel.connections.create",
  "channel.connections.update",
  "channel.connections.test",
  "channel.connections.enable",
  "channel.connections.disable",
  "channel.webhooks.receive",
  "channel.syncruns.start",
  "channel.syncruns.read",
  "channel.syncruns.cancel",
  "channel.operations.read",
  "channel.operations.replay",
] as const satisfies readonly OperationId[]);

export interface ChannelOperations {
  readonly distributorsCreate: OperationMethod<"channel.distributors.create">;
  readonly distributorsRead: OperationMethod<"channel.distributors.read">;
  readonly distributorsUpdate: OperationMethod<"channel.distributors.update">;
  readonly distributorsDisable: OperationMethod<"channel.distributors.disable">;
  readonly bindingsManage: OperationMethod<"channel.bindings.manage">;
  readonly quotasManage: OperationMethod<"channel.quotas.manage">;
  readonly connectionsRead: OperationMethod<"channel.connections.read">;
  readonly connectionsCreate: OperationMethod<"channel.connections.create">;
  readonly connectionsUpdate: OperationMethod<"channel.connections.update">;
  readonly connectionsTest: OperationMethod<"channel.connections.test">;
  readonly connectionsEnable: OperationMethod<"channel.connections.enable">;
  readonly connectionsDisable: OperationMethod<"channel.connections.disable">;
  readonly webhooksReceive: OperationMethod<"channel.webhooks.receive">;
  readonly syncrunsStart: OperationMethod<"channel.syncruns.start">;
  readonly syncrunsRead: OperationMethod<"channel.syncruns.read">;
  readonly syncrunsCancel: OperationMethod<"channel.syncruns.cancel">;
  readonly operationsRead: OperationMethod<"channel.operations.read">;
  readonly operationsReplay: OperationMethod<"channel.operations.replay">;
}

export const CHANNEL_METHOD_BY_OPERATION = Object.freeze({
  "channel.distributors.create": "distributorsCreate",
  "channel.distributors.read": "distributorsRead",
  "channel.distributors.update": "distributorsUpdate",
  "channel.distributors.disable": "distributorsDisable",
  "channel.bindings.manage": "bindingsManage",
  "channel.quotas.manage": "quotasManage",
  "channel.connections.read": "connectionsRead",
  "channel.connections.create": "connectionsCreate",
  "channel.connections.update": "connectionsUpdate",
  "channel.connections.test": "connectionsTest",
  "channel.connections.enable": "connectionsEnable",
  "channel.connections.disable": "connectionsDisable",
  "channel.webhooks.receive": "webhooksReceive",
  "channel.syncruns.start": "syncrunsStart",
  "channel.syncruns.read": "syncrunsRead",
  "channel.syncruns.cancel": "syncrunsCancel",
  "channel.operations.read": "operationsRead",
  "channel.operations.replay": "operationsReplay",
} as const satisfies Readonly<Record<(typeof CHANNEL_OPERATION_IDS)[number], keyof ChannelOperations>>);

export function createFetchChannel(baseUrl: string): ChannelOperations { return createChannelOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createChannelOperations(client: OperationExecutor): ChannelOperations { return Object.freeze({
    distributorsCreate: bindDistributorsCreate(client),
    distributorsRead: bindDistributorsRead(client),
    distributorsUpdate: bindDistributorsUpdate(client),
    distributorsDisable: bindDistributorsDisable(client),
    bindingsManage: bindBindingsManage(client),
    quotasManage: bindQuotasManage(client),
    connectionsRead: bindConnectionsRead(client),
    connectionsCreate: bindConnectionsCreate(client),
    connectionsUpdate: bindConnectionsUpdate(client),
    connectionsTest: bindConnectionsTest(client),
    connectionsEnable: bindConnectionsEnable(client),
    connectionsDisable: bindConnectionsDisable(client),
    webhooksReceive: bindWebhooksReceive(client),
    syncrunsStart: bindSyncrunsStart(client),
    syncrunsRead: bindSyncrunsRead(client),
    syncrunsCancel: bindSyncrunsCancel(client),
    operationsRead: bindOperationsRead(client),
    operationsReplay: bindOperationsReplay(client),
  }); }

export function createFetchChannelDistributorsCreate(baseUrl: string): OperationMethod<"channel.distributors.create"> { return bindDistributorsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindDistributorsCreate(client: OperationExecutor): OperationMethod<"channel.distributors.create"> { return bindOperation(client, defineOperation({ ...{"id":"channel.distributors.create","method":"POST","path":"/api/v1/channels/distributors","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ChannelDistributorsCreateInput", [] as const, true), output: exactOperationOutput("ChannelDistributorsCreateOutput") })); }

export function createFetchChannelDistributorsRead(baseUrl: string): OperationMethod<"channel.distributors.read"> { return bindDistributorsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindDistributorsRead(client: OperationExecutor): OperationMethod<"channel.distributors.read"> { return bindOperation(client, defineOperation({ ...{"id":"channel.distributors.read","method":"GET","path":"/api/v1/channels/distributors","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ChannelDistributorsReadInput", [] as const, false), output: exactOperationOutput("ChannelDistributorsReadOutput") })); }

export function createFetchChannelDistributorsUpdate(baseUrl: string): OperationMethod<"channel.distributors.update"> { return bindDistributorsUpdate(new ApiClient(baseUrl, new FetchTransport())); }

function bindDistributorsUpdate(client: OperationExecutor): OperationMethod<"channel.distributors.update"> { return bindOperation(client, defineOperation({ ...{"id":"channel.distributors.update","method":"PATCH","path":"/api/v1/channels/distributors/{distributorid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ChannelDistributorsUpdateInput", ["distributorid"] as const, true), output: exactOperationOutput("ChannelDistributorsUpdateOutput") })); }

export function createFetchChannelDistributorsDisable(baseUrl: string): OperationMethod<"channel.distributors.disable"> { return bindDistributorsDisable(new ApiClient(baseUrl, new FetchTransport())); }

function bindDistributorsDisable(client: OperationExecutor): OperationMethod<"channel.distributors.disable"> { return bindOperation(client, defineOperation({ ...{"id":"channel.distributors.disable","method":"DELETE","path":"/api/v1/channels/distributors/{distributorid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ChannelDistributorsDisableInput", ["distributorid"] as const, true), output: exactOperationOutput("ChannelDistributorsDisableOutput") })); }

export function createFetchChannelBindingsManage(baseUrl: string): OperationMethod<"channel.bindings.manage"> { return bindBindingsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindBindingsManage(client: OperationExecutor): OperationMethod<"channel.bindings.manage"> { return bindOperation(client, defineOperation({ ...{"id":"channel.bindings.manage","method":"PUT","path":"/api/v1/channels/bindings/{bindingid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ChannelBindingsManageInput", ["bindingid"] as const, true), output: exactOperationOutput("ChannelBindingsManageOutput") })); }

export function createFetchChannelQuotasManage(baseUrl: string): OperationMethod<"channel.quotas.manage"> { return bindQuotasManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindQuotasManage(client: OperationExecutor): OperationMethod<"channel.quotas.manage"> { return bindOperation(client, defineOperation({ ...{"id":"channel.quotas.manage","method":"PUT","path":"/api/v1/channels/quotas/{quotaid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ChannelQuotasManageInput", ["quotaid"] as const, true), output: exactOperationOutput("ChannelQuotasManageOutput") })); }

export function createFetchChannelConnectionsRead(baseUrl: string): OperationMethod<"channel.connections.read"> { return bindConnectionsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindConnectionsRead(client: OperationExecutor): OperationMethod<"channel.connections.read"> { return bindOperation(client, defineOperation({ ...{"id":"channel.connections.read","method":"GET","path":"/api/v1/channels/connections","audience":"console","targets":["console","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ChannelConnectionsReadInput", [] as const, false), output: exactOperationOutput("ChannelConnectionsReadOutput") })); }

export function createFetchChannelConnectionsCreate(baseUrl: string): OperationMethod<"channel.connections.create"> { return bindConnectionsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindConnectionsCreate(client: OperationExecutor): OperationMethod<"channel.connections.create"> { return bindOperation(client, defineOperation({ ...{"id":"channel.connections.create","method":"POST","path":"/api/v1/channels/connections","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ChannelConnectionsCreateInput", [] as const, true), output: exactOperationOutput("ChannelConnectionsCreateOutput") })); }

export function createFetchChannelConnectionsUpdate(baseUrl: string): OperationMethod<"channel.connections.update"> { return bindConnectionsUpdate(new ApiClient(baseUrl, new FetchTransport())); }

function bindConnectionsUpdate(client: OperationExecutor): OperationMethod<"channel.connections.update"> { return bindOperation(client, defineOperation({ ...{"id":"channel.connections.update","method":"PATCH","path":"/api/v1/channels/connections/{connectionid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ChannelConnectionsUpdateInput", ["connectionid"] as const, true), output: exactOperationOutput("ChannelConnectionsUpdateOutput") })); }

export function createFetchChannelConnectionsTest(baseUrl: string): OperationMethod<"channel.connections.test"> { return bindConnectionsTest(new ApiClient(baseUrl, new FetchTransport())); }

function bindConnectionsTest(client: OperationExecutor): OperationMethod<"channel.connections.test"> { return bindOperation(client, defineOperation({ ...{"id":"channel.connections.test","method":"POST","path":"/api/v1/channels/connections/{connectionid}/tests","audience":"console","targets":["console","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ChannelConnectionsTestInput", ["connectionid"] as const, true), output: exactOperationOutput("ChannelConnectionsTestOutput") })); }

export function createFetchChannelConnectionsEnable(baseUrl: string): OperationMethod<"channel.connections.enable"> { return bindConnectionsEnable(new ApiClient(baseUrl, new FetchTransport())); }

function bindConnectionsEnable(client: OperationExecutor): OperationMethod<"channel.connections.enable"> { return bindOperation(client, defineOperation({ ...{"id":"channel.connections.enable","method":"PUT","path":"/api/v1/channels/connections/{connectionid}/enablement","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ChannelConnectionsEnableInput", ["connectionid"] as const, true), output: exactOperationOutput("ChannelConnectionsEnableOutput") })); }

export function createFetchChannelConnectionsDisable(baseUrl: string): OperationMethod<"channel.connections.disable"> { return bindConnectionsDisable(new ApiClient(baseUrl, new FetchTransport())); }

function bindConnectionsDisable(client: OperationExecutor): OperationMethod<"channel.connections.disable"> { return bindOperation(client, defineOperation({ ...{"id":"channel.connections.disable","method":"DELETE","path":"/api/v1/channels/connections/{connectionid}/enablement","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ChannelConnectionsDisableInput", ["connectionid"] as const, true), output: exactOperationOutput("ChannelConnectionsDisableOutput") })); }

export function createFetchChannelWebhooksReceive(baseUrl: string): OperationMethod<"channel.webhooks.receive"> { return bindWebhooksReceive(new ApiClient(baseUrl, new FetchTransport())); }

function bindWebhooksReceive(client: OperationExecutor): OperationMethod<"channel.webhooks.receive"> { return bindOperation(client, defineOperation({ ...{"id":"channel.webhooks.receive","method":"POST","path":"/api/v1/channels/webhooks/{connectionid}","audience":"webhook","targets":[],"responseMode":"json","idempotencyPolicy":"provider","idempotent":true,"timeout":500,"errorUnion":["AUTHORIZATION_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ChannelWebhooksReceiveInput", ["connectionid"] as const, true), output: exactOperationOutput("ChannelWebhooksReceiveOutput") })); }

export function createFetchChannelSyncrunsStart(baseUrl: string): OperationMethod<"channel.syncruns.start"> { return bindSyncrunsStart(new ApiClient(baseUrl, new FetchTransport())); }

function bindSyncrunsStart(client: OperationExecutor): OperationMethod<"channel.syncruns.start"> { return bindOperation(client, defineOperation({ ...{"id":"channel.syncruns.start","method":"POST","path":"/api/v1/channels/syncruns","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ChannelSyncrunsStartInput", [] as const, true), output: exactOperationOutput("ChannelSyncrunsStartOutput") })); }

export function createFetchChannelSyncrunsRead(baseUrl: string): OperationMethod<"channel.syncruns.read"> { return bindSyncrunsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindSyncrunsRead(client: OperationExecutor): OperationMethod<"channel.syncruns.read"> { return bindOperation(client, defineOperation({ ...{"id":"channel.syncruns.read","method":"GET","path":"/api/v1/channels/syncruns","audience":"console","targets":["console","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ChannelSyncrunsReadInput", [] as const, false), output: exactOperationOutput("ChannelSyncrunsReadOutput") })); }

export function createFetchChannelSyncrunsCancel(baseUrl: string): OperationMethod<"channel.syncruns.cancel"> { return bindSyncrunsCancel(new ApiClient(baseUrl, new FetchTransport())); }

function bindSyncrunsCancel(client: OperationExecutor): OperationMethod<"channel.syncruns.cancel"> { return bindOperation(client, defineOperation({ ...{"id":"channel.syncruns.cancel","method":"DELETE","path":"/api/v1/channels/syncruns/{runid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("ChannelSyncrunsCancelInput", ["runid"] as const, true), output: exactOperationOutput("ChannelSyncrunsCancelOutput") })); }

export function createFetchChannelOperationsRead(baseUrl: string): OperationMethod<"channel.operations.read"> { return bindOperationsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindOperationsRead(client: OperationExecutor): OperationMethod<"channel.operations.read"> { return bindOperation(client, defineOperation({ ...{"id":"channel.operations.read","method":"GET","path":"/api/v1/channels/operations","audience":"console","targets":["console","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ChannelOperationsReadInput", [] as const, false), output: exactOperationOutput("ChannelOperationsReadOutput") })); }

export function createFetchChannelOperationsReplay(baseUrl: string): OperationMethod<"channel.operations.replay"> { return bindOperationsReplay(new ApiClient(baseUrl, new FetchTransport())); }

function bindOperationsReplay(client: OperationExecutor): OperationMethod<"channel.operations.replay"> { return bindOperation(client, defineOperation({ ...{"id":"channel.operations.replay","method":"POST","path":"/api/v1/channels/operations/{operationid}/replays","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ChannelOperationsReplayInput", ["operationid"] as const, true), output: exactOperationOutput("ChannelOperationsReplayOutput") })); }
