// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const CHANNEL_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
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

export function createFetchChannel(baseUrl: string): ChannelOperations {
  return createChannelOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createChannelOperations(client: OperationExecutor): ChannelOperations {
  return Object.freeze({
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
  });
}

export function createFetchChannelDistributorsCreate(baseUrl: string): OperationMethod<"channel.distributors.create"> {
  return bindDistributorsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindDistributorsCreate(client: OperationExecutor): OperationMethod<"channel.distributors.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.distributors.create","method":"POST","path":"/api/v1/channels/distributors","audience":"operator","idempotent":false,"pathKeys":[]}));
}

export function createFetchChannelDistributorsRead(baseUrl: string): OperationMethod<"channel.distributors.read"> {
  return bindDistributorsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindDistributorsRead(client: OperationExecutor): OperationMethod<"channel.distributors.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.distributors.read","method":"GET","path":"/api/v1/channels/distributors","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchChannelDistributorsUpdate(baseUrl: string): OperationMethod<"channel.distributors.update"> {
  return bindDistributorsUpdate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindDistributorsUpdate(client: OperationExecutor): OperationMethod<"channel.distributors.update"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.distributors.update","method":"PATCH","path":"/api/v1/channels/distributors/{distributorid}","audience":"operator","idempotent":false,"pathKeys":["distributorid"]}));
}

export function createFetchChannelDistributorsDisable(baseUrl: string): OperationMethod<"channel.distributors.disable"> {
  return bindDistributorsDisable(new ApiClient(baseUrl, new FetchTransport()));
}

function bindDistributorsDisable(client: OperationExecutor): OperationMethod<"channel.distributors.disable"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.distributors.disable","method":"DELETE","path":"/api/v1/channels/distributors/{distributorid}","audience":"operator","idempotent":true,"pathKeys":["distributorid"]}));
}

export function createFetchChannelBindingsManage(baseUrl: string): OperationMethod<"channel.bindings.manage"> {
  return bindBindingsManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindBindingsManage(client: OperationExecutor): OperationMethod<"channel.bindings.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.bindings.manage","method":"PUT","path":"/api/v1/channels/bindings/{bindingid}","audience":"operator","idempotent":true,"pathKeys":["bindingid"]}));
}

export function createFetchChannelQuotasManage(baseUrl: string): OperationMethod<"channel.quotas.manage"> {
  return bindQuotasManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindQuotasManage(client: OperationExecutor): OperationMethod<"channel.quotas.manage"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.quotas.manage","method":"PUT","path":"/api/v1/channels/quotas/{quotaid}","audience":"operator","idempotent":true,"pathKeys":["quotaid"]}));
}

export function createFetchChannelConnectionsRead(baseUrl: string): OperationMethod<"channel.connections.read"> {
  return bindConnectionsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindConnectionsRead(client: OperationExecutor): OperationMethod<"channel.connections.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.connections.read","method":"GET","path":"/api/v1/channels/connections","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchChannelConnectionsCreate(baseUrl: string): OperationMethod<"channel.connections.create"> {
  return bindConnectionsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindConnectionsCreate(client: OperationExecutor): OperationMethod<"channel.connections.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.connections.create","method":"POST","path":"/api/v1/channels/connections","audience":"operator","idempotent":false,"pathKeys":[]}));
}

export function createFetchChannelConnectionsUpdate(baseUrl: string): OperationMethod<"channel.connections.update"> {
  return bindConnectionsUpdate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindConnectionsUpdate(client: OperationExecutor): OperationMethod<"channel.connections.update"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.connections.update","method":"PATCH","path":"/api/v1/channels/connections/{connectionid}","audience":"operator","idempotent":false,"pathKeys":["connectionid"]}));
}

export function createFetchChannelConnectionsTest(baseUrl: string): OperationMethod<"channel.connections.test"> {
  return bindConnectionsTest(new ApiClient(baseUrl, new FetchTransport()));
}

function bindConnectionsTest(client: OperationExecutor): OperationMethod<"channel.connections.test"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.connections.test","method":"POST","path":"/api/v1/channels/connections/{connectionid}/tests","audience":"operator","idempotent":false,"pathKeys":["connectionid"]}));
}

export function createFetchChannelConnectionsEnable(baseUrl: string): OperationMethod<"channel.connections.enable"> {
  return bindConnectionsEnable(new ApiClient(baseUrl, new FetchTransport()));
}

function bindConnectionsEnable(client: OperationExecutor): OperationMethod<"channel.connections.enable"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.connections.enable","method":"PUT","path":"/api/v1/channels/connections/{connectionid}/enablement","audience":"operator","idempotent":true,"pathKeys":["connectionid"]}));
}

export function createFetchChannelConnectionsDisable(baseUrl: string): OperationMethod<"channel.connections.disable"> {
  return bindConnectionsDisable(new ApiClient(baseUrl, new FetchTransport()));
}

function bindConnectionsDisable(client: OperationExecutor): OperationMethod<"channel.connections.disable"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.connections.disable","method":"DELETE","path":"/api/v1/channels/connections/{connectionid}/enablement","audience":"operator","idempotent":true,"pathKeys":["connectionid"]}));
}

export function createFetchChannelWebhooksReceive(baseUrl: string): OperationMethod<"channel.webhooks.receive"> {
  return bindWebhooksReceive(new ApiClient(baseUrl, new FetchTransport()));
}

function bindWebhooksReceive(client: OperationExecutor): OperationMethod<"channel.webhooks.receive"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.webhooks.receive","method":"POST","path":"/api/v1/channels/webhooks/{connectionid}","audience":"provider","idempotent":true,"pathKeys":["connectionid"]}));
}

export function createFetchChannelSyncrunsStart(baseUrl: string): OperationMethod<"channel.syncruns.start"> {
  return bindSyncrunsStart(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSyncrunsStart(client: OperationExecutor): OperationMethod<"channel.syncruns.start"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.syncruns.start","method":"POST","path":"/api/v1/channels/syncruns","audience":"operator","idempotent":false,"pathKeys":[]}));
}

export function createFetchChannelSyncrunsRead(baseUrl: string): OperationMethod<"channel.syncruns.read"> {
  return bindSyncrunsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSyncrunsRead(client: OperationExecutor): OperationMethod<"channel.syncruns.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.syncruns.read","method":"GET","path":"/api/v1/channels/syncruns","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchChannelSyncrunsCancel(baseUrl: string): OperationMethod<"channel.syncruns.cancel"> {
  return bindSyncrunsCancel(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSyncrunsCancel(client: OperationExecutor): OperationMethod<"channel.syncruns.cancel"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.syncruns.cancel","method":"DELETE","path":"/api/v1/channels/syncruns/{runid}","audience":"operator","idempotent":true,"pathKeys":["runid"]}));
}

export function createFetchChannelOperationsRead(baseUrl: string): OperationMethod<"channel.operations.read"> {
  return bindOperationsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOperationsRead(client: OperationExecutor): OperationMethod<"channel.operations.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.operations.read","method":"GET","path":"/api/v1/channels/operations","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchChannelOperationsReplay(baseUrl: string): OperationMethod<"channel.operations.replay"> {
  return bindOperationsReplay(new ApiClient(baseUrl, new FetchTransport()));
}

function bindOperationsReplay(client: OperationExecutor): OperationMethod<"channel.operations.replay"> {
  return bindOperation(client, defineStructuralOperation({"id":"channel.operations.replay","method":"POST","path":"/api/v1/channels/operations/{operationid}/replays","audience":"operator","idempotent":false,"pathKeys":["operationid"]}));
}
