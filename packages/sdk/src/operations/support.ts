// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, defineOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const SUPPORT_OPERATION_IDS = Object.freeze([
  "support.cases.create",
  "support.cases.read",
  "support.cases.update",
  "support.cases.close",
  "support.cases.reopen",
  "support.messages.send",
  "support.messages.read",
  "support.attachments.create",
  "support.assignments.manage",
  "support.agents.manage",
  "support.agents.read",
  "support.accounts.manage",
  "support.accounts.read",
  "support.rules.read",
  "support.rules.manage",
  "support.slas.read",
  "support.slas.manage",
  "support.history.read",
  "support.events.read",
  "support.readstates.manage",
] as const satisfies readonly OperationId[]);

export interface SupportOperations {
  readonly casesCreate: OperationMethod<"support.cases.create">;
  readonly casesRead: OperationMethod<"support.cases.read">;
  readonly casesUpdate: OperationMethod<"support.cases.update">;
  readonly casesClose: OperationMethod<"support.cases.close">;
  readonly casesReopen: OperationMethod<"support.cases.reopen">;
  readonly messagesSend: OperationMethod<"support.messages.send">;
  readonly messagesRead: OperationMethod<"support.messages.read">;
  readonly attachmentsCreate: OperationMethod<"support.attachments.create">;
  readonly assignmentsManage: OperationMethod<"support.assignments.manage">;
  readonly agentsManage: OperationMethod<"support.agents.manage">;
  readonly agentsRead: OperationMethod<"support.agents.read">;
  readonly accountsManage: OperationMethod<"support.accounts.manage">;
  readonly accountsRead: OperationMethod<"support.accounts.read">;
  readonly rulesRead: OperationMethod<"support.rules.read">;
  readonly rulesManage: OperationMethod<"support.rules.manage">;
  readonly slasRead: OperationMethod<"support.slas.read">;
  readonly slasManage: OperationMethod<"support.slas.manage">;
  readonly historyRead: OperationMethod<"support.history.read">;
  readonly eventsRead: EventOperationMethod<"support.events.read">;
  readonly readstatesManage: OperationMethod<"support.readstates.manage">;
}

export function createFetchSupport(baseUrl: string): SupportOperations { return createSupportOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createSupportOperations(client: OperationExecutor): SupportOperations { return Object.freeze({
    casesCreate: bindCasesCreate(client),
    casesRead: bindCasesRead(client),
    casesUpdate: bindCasesUpdate(client),
    casesClose: bindCasesClose(client),
    casesReopen: bindCasesReopen(client),
    messagesSend: bindMessagesSend(client),
    messagesRead: bindMessagesRead(client),
    attachmentsCreate: bindAttachmentsCreate(client),
    assignmentsManage: bindAssignmentsManage(client),
    agentsManage: bindAgentsManage(client),
    agentsRead: bindAgentsRead(client),
    accountsManage: bindAccountsManage(client),
    accountsRead: bindAccountsRead(client),
    rulesRead: bindRulesRead(client),
    rulesManage: bindRulesManage(client),
    slasRead: bindSlasRead(client),
    slasManage: bindSlasManage(client),
    historyRead: bindHistoryRead(client),
    eventsRead: bindEventsRead(client),
    readstatesManage: bindReadstatesManage(client),
  }); }

export function createFetchSupportCasesCreate(baseUrl: string): OperationMethod<"support.cases.create"> { return bindCasesCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindCasesCreate(client: OperationExecutor): OperationMethod<"support.cases.create"> { return bindOperation(client, defineOperation({"id":"support.cases.create","method":"POST","path":"/api/v1/support/cases","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchSupportCasesRead(baseUrl: string): OperationMethod<"support.cases.read"> { return bindCasesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindCasesRead(client: OperationExecutor): OperationMethod<"support.cases.read"> { return bindOperation(client, defineOperation({"id":"support.cases.read","method":"GET","path":"/api/v1/support/cases","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchSupportCasesUpdate(baseUrl: string): OperationMethod<"support.cases.update"> { return bindCasesUpdate(new ApiClient(baseUrl, new FetchTransport())); }

function bindCasesUpdate(client: OperationExecutor): OperationMethod<"support.cases.update"> { return bindOperation(client, defineOperation({"id":"support.cases.update","method":"PATCH","path":"/api/v1/support/cases/{caseid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchSupportCasesClose(baseUrl: string): OperationMethod<"support.cases.close"> { return bindCasesClose(new ApiClient(baseUrl, new FetchTransport())); }

function bindCasesClose(client: OperationExecutor): OperationMethod<"support.cases.close"> { return bindOperation(client, defineOperation({"id":"support.cases.close","method":"PUT","path":"/api/v1/support/cases/{caseid}/closure","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchSupportCasesReopen(baseUrl: string): OperationMethod<"support.cases.reopen"> { return bindCasesReopen(new ApiClient(baseUrl, new FetchTransport())); }

function bindCasesReopen(client: OperationExecutor): OperationMethod<"support.cases.reopen"> { return bindOperation(client, defineOperation({"id":"support.cases.reopen","method":"DELETE","path":"/api/v1/support/cases/{caseid}/closure","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchSupportMessagesSend(baseUrl: string): OperationMethod<"support.messages.send"> { return bindMessagesSend(new ApiClient(baseUrl, new FetchTransport())); }

function bindMessagesSend(client: OperationExecutor): OperationMethod<"support.messages.send"> { return bindOperation(client, defineOperation({"id":"support.messages.send","method":"POST","path":"/api/v1/support/cases/{caseid}/messages","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchSupportMessagesRead(baseUrl: string): OperationMethod<"support.messages.read"> { return bindMessagesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindMessagesRead(client: OperationExecutor): OperationMethod<"support.messages.read"> { return bindOperation(client, defineOperation({"id":"support.messages.read","method":"GET","path":"/api/v1/support/cases/{caseid}/messages","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchSupportAttachmentsCreate(baseUrl: string): OperationMethod<"support.attachments.create"> { return bindAttachmentsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindAttachmentsCreate(client: OperationExecutor): OperationMethod<"support.attachments.create"> { return bindOperation(client, defineOperation({"id":"support.attachments.create","method":"POST","path":"/api/v1/support/cases/{caseid}/attachments","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchSupportAssignmentsManage(baseUrl: string): OperationMethod<"support.assignments.manage"> { return bindAssignmentsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindAssignmentsManage(client: OperationExecutor): OperationMethod<"support.assignments.manage"> { return bindOperation(client, defineOperation({"id":"support.assignments.manage","method":"PUT","path":"/api/v1/support/assignments/{assignmentid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchSupportAgentsManage(baseUrl: string): OperationMethod<"support.agents.manage"> { return bindAgentsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindAgentsManage(client: OperationExecutor): OperationMethod<"support.agents.manage"> { return bindOperation(client, defineOperation({"id":"support.agents.manage","method":"PUT","path":"/api/v1/support/agents/{agentid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchSupportAgentsRead(baseUrl: string): OperationMethod<"support.agents.read"> { return bindAgentsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindAgentsRead(client: OperationExecutor): OperationMethod<"support.agents.read"> { return bindOperation(client, defineOperation({"id":"support.agents.read","method":"GET","path":"/api/v1/support/agents","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchSupportAccountsManage(baseUrl: string): OperationMethod<"support.accounts.manage"> { return bindAccountsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindAccountsManage(client: OperationExecutor): OperationMethod<"support.accounts.manage"> { return bindOperation(client, defineOperation({"id":"support.accounts.manage","method":"PUT","path":"/api/v1/support/accounts/{accountid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchSupportAccountsRead(baseUrl: string): OperationMethod<"support.accounts.read"> { return bindAccountsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindAccountsRead(client: OperationExecutor): OperationMethod<"support.accounts.read"> { return bindOperation(client, defineOperation({"id":"support.accounts.read","method":"GET","path":"/api/v1/support/accounts","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchSupportRulesRead(baseUrl: string): OperationMethod<"support.rules.read"> { return bindRulesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindRulesRead(client: OperationExecutor): OperationMethod<"support.rules.read"> { return bindOperation(client, defineOperation({"id":"support.rules.read","method":"GET","path":"/api/v1/support/rules","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchSupportRulesManage(baseUrl: string): OperationMethod<"support.rules.manage"> { return bindRulesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindRulesManage(client: OperationExecutor): OperationMethod<"support.rules.manage"> { return bindOperation(client, defineOperation({"id":"support.rules.manage","method":"PUT","path":"/api/v1/support/rules/{ruleid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchSupportSlasRead(baseUrl: string): OperationMethod<"support.slas.read"> { return bindSlasRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindSlasRead(client: OperationExecutor): OperationMethod<"support.slas.read"> { return bindOperation(client, defineOperation({"id":"support.slas.read","method":"GET","path":"/api/v1/support/slas","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchSupportSlasManage(baseUrl: string): OperationMethod<"support.slas.manage"> { return bindSlasManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindSlasManage(client: OperationExecutor): OperationMethod<"support.slas.manage"> { return bindOperation(client, defineOperation({"id":"support.slas.manage","method":"PUT","path":"/api/v1/support/slas/{slaid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchSupportHistoryRead(baseUrl: string): OperationMethod<"support.history.read"> { return bindHistoryRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindHistoryRead(client: OperationExecutor): OperationMethod<"support.history.read"> { return bindOperation(client, defineOperation({"id":"support.history.read","method":"GET","path":"/api/v1/support/cases/{caseid}/history","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchSupportEventsRead(baseUrl: string): EventOperationMethod<"support.events.read"> { return bindEventsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindEventsRead(client: OperationExecutor): EventOperationMethod<"support.events.read"> { return bindEventOperation(client, defineOperation({"id":"support.events.read","method":"GET","path":"/api/v1/support/events","audience":"public","targets":["console","storefront"],"responseMode":"stream","idempotent":true,"timeout":15000})); }

export function createFetchSupportReadstatesManage(baseUrl: string): OperationMethod<"support.readstates.manage"> { return bindReadstatesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindReadstatesManage(client: OperationExecutor): OperationMethod<"support.readstates.manage"> { return bindOperation(client, defineOperation({"id":"support.readstates.manage","method":"PUT","path":"/api/v1/support/conversations/{conversationid}/readstate","audience":"public","targets":["console","storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }
