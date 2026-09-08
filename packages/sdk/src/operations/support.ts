// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInputFrom, exactOperationOutputFrom } from '@shop/contract/operationschema';
import { SUPPORT_BODY_SCHEMAS, SUPPORT_QUERY_SCHEMAS, SUPPORT_OUTPUT_SCHEMAS } from '@shop/contract/schema/Support';
import { defineOperation } from '../CatalogOperationDescriptor';

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

export const SUPPORT_METHOD_BY_OPERATION = Object.freeze({
  "support.cases.create": "casesCreate",
  "support.cases.read": "casesRead",
  "support.cases.update": "casesUpdate",
  "support.cases.close": "casesClose",
  "support.cases.reopen": "casesReopen",
  "support.messages.send": "messagesSend",
  "support.messages.read": "messagesRead",
  "support.attachments.create": "attachmentsCreate",
  "support.assignments.manage": "assignmentsManage",
  "support.agents.manage": "agentsManage",
  "support.agents.read": "agentsRead",
  "support.accounts.manage": "accountsManage",
  "support.accounts.read": "accountsRead",
  "support.rules.read": "rulesRead",
  "support.rules.manage": "rulesManage",
  "support.slas.read": "slasRead",
  "support.slas.manage": "slasManage",
  "support.history.read": "historyRead",
  "support.events.read": "eventsRead",
  "support.readstates.manage": "readstatesManage",
} as const satisfies Readonly<Record<(typeof SUPPORT_OPERATION_IDS)[number], keyof SupportOperations>>);

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

export function bindCasesCreate(client: OperationExecutor): OperationMethod<"support.cases.create"> { return bindOperation(client, defineOperation({ ...{"id":"support.cases.create","method":"POST","path":"/api/v1/support/cases","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(SUPPORT_BODY_SCHEMAS.SupportCasesCreateInput, [] as const, true), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportCasesCreateOutput) })); }

export function createFetchSupportCasesRead(baseUrl: string): OperationMethod<"support.cases.read"> { return bindCasesRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindCasesRead(client: OperationExecutor): OperationMethod<"support.cases.read"> { return bindOperation(client, defineOperation({ ...{"id":"support.cases.read","method":"GET","path":"/api/v1/support/cases","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(SUPPORT_QUERY_SCHEMAS.SupportCasesReadInput, [] as const, false), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportCasesReadOutput) })); }

export function createFetchSupportCasesUpdate(baseUrl: string): OperationMethod<"support.cases.update"> { return bindCasesUpdate(new ApiClient(baseUrl, new FetchTransport())); }

export function bindCasesUpdate(client: OperationExecutor): OperationMethod<"support.cases.update"> { return bindOperation(client, defineOperation({ ...{"id":"support.cases.update","method":"PATCH","path":"/api/v1/support/cases/{caseid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(SUPPORT_BODY_SCHEMAS.SupportCasesUpdateInput, ["caseid"] as const, true), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportCasesUpdateOutput) })); }

export function createFetchSupportCasesClose(baseUrl: string): OperationMethod<"support.cases.close"> { return bindCasesClose(new ApiClient(baseUrl, new FetchTransport())); }

export function bindCasesClose(client: OperationExecutor): OperationMethod<"support.cases.close"> { return bindOperation(client, defineOperation({ ...{"id":"support.cases.close","method":"PUT","path":"/api/v1/support/cases/{caseid}/closure","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(SUPPORT_BODY_SCHEMAS.SupportCasesCloseInput, ["caseid"] as const, true), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportCasesCloseOutput) })); }

export function createFetchSupportCasesReopen(baseUrl: string): OperationMethod<"support.cases.reopen"> { return bindCasesReopen(new ApiClient(baseUrl, new FetchTransport())); }

export function bindCasesReopen(client: OperationExecutor): OperationMethod<"support.cases.reopen"> { return bindOperation(client, defineOperation({ ...{"id":"support.cases.reopen","method":"DELETE","path":"/api/v1/support/cases/{caseid}/closure","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(SUPPORT_BODY_SCHEMAS.SupportCasesReopenInput, ["caseid"] as const, true), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportCasesReopenOutput) })); }

export function createFetchSupportMessagesSend(baseUrl: string): OperationMethod<"support.messages.send"> { return bindMessagesSend(new ApiClient(baseUrl, new FetchTransport())); }

export function bindMessagesSend(client: OperationExecutor): OperationMethod<"support.messages.send"> { return bindOperation(client, defineOperation({ ...{"id":"support.messages.send","method":"POST","path":"/api/v1/support/cases/{caseid}/messages","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","SUPPORT_ATTACHMENT_NOT_READY","SUPPORT_ATTACHMENT_REJECTED","SUPPORT_CLIENT_MESSAGE_CONFLICT","SUPPORT_MESSAGE_VISIBILITY_DENIED","SUPPORT_TICKET_NOT_WRITABLE","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(SUPPORT_BODY_SCHEMAS.SupportMessagesSendInput, ["caseid"] as const, true), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportMessagesSendOutput) })); }

export function createFetchSupportMessagesRead(baseUrl: string): OperationMethod<"support.messages.read"> { return bindMessagesRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindMessagesRead(client: OperationExecutor): OperationMethod<"support.messages.read"> { return bindOperation(client, defineOperation({ ...{"id":"support.messages.read","method":"GET","path":"/api/v1/support/cases/{caseid}/messages","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(SUPPORT_QUERY_SCHEMAS.SupportMessagesReadInput, ["caseid"] as const, false), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportMessagesReadOutput) })); }

export function createFetchSupportAttachmentsCreate(baseUrl: string): OperationMethod<"support.attachments.create"> { return bindAttachmentsCreate(new ApiClient(baseUrl, new FetchTransport())); }

export function bindAttachmentsCreate(client: OperationExecutor): OperationMethod<"support.attachments.create"> { return bindOperation(client, defineOperation({ ...{"id":"support.attachments.create","method":"POST","path":"/api/v1/support/cases/{caseid}/attachments","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(SUPPORT_BODY_SCHEMAS.SupportAttachmentsCreateInput, ["caseid"] as const, true), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportAttachmentsCreateOutput) })); }

export function createFetchSupportAssignmentsManage(baseUrl: string): OperationMethod<"support.assignments.manage"> { return bindAssignmentsManage(new ApiClient(baseUrl, new FetchTransport())); }

export function bindAssignmentsManage(client: OperationExecutor): OperationMethod<"support.assignments.manage"> { return bindOperation(client, defineOperation({ ...{"id":"support.assignments.manage","method":"PUT","path":"/api/v1/support/assignments/{assignmentid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(SUPPORT_BODY_SCHEMAS.SupportAssignmentsManageInput, ["assignmentid"] as const, true), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportAssignmentsManageOutput) })); }

export function createFetchSupportAgentsManage(baseUrl: string): OperationMethod<"support.agents.manage"> { return bindAgentsManage(new ApiClient(baseUrl, new FetchTransport())); }

export function bindAgentsManage(client: OperationExecutor): OperationMethod<"support.agents.manage"> { return bindOperation(client, defineOperation({ ...{"id":"support.agents.manage","method":"PUT","path":"/api/v1/support/agents/{agentid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(SUPPORT_BODY_SCHEMAS.SupportAgentsManageInput, ["agentid"] as const, true), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportAgentsManageOutput) })); }

export function createFetchSupportAgentsRead(baseUrl: string): OperationMethod<"support.agents.read"> { return bindAgentsRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindAgentsRead(client: OperationExecutor): OperationMethod<"support.agents.read"> { return bindOperation(client, defineOperation({ ...{"id":"support.agents.read","method":"GET","path":"/api/v1/support/agents","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(SUPPORT_QUERY_SCHEMAS.SupportAgentsReadInput, [] as const, false), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportAgentsReadOutput) })); }

export function createFetchSupportAccountsManage(baseUrl: string): OperationMethod<"support.accounts.manage"> { return bindAccountsManage(new ApiClient(baseUrl, new FetchTransport())); }

export function bindAccountsManage(client: OperationExecutor): OperationMethod<"support.accounts.manage"> { return bindOperation(client, defineOperation({ ...{"id":"support.accounts.manage","method":"PUT","path":"/api/v1/support/accounts/{accountid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(SUPPORT_BODY_SCHEMAS.SupportAccountsManageInput, ["accountid"] as const, true), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportAccountsManageOutput) })); }

export function createFetchSupportAccountsRead(baseUrl: string): OperationMethod<"support.accounts.read"> { return bindAccountsRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindAccountsRead(client: OperationExecutor): OperationMethod<"support.accounts.read"> { return bindOperation(client, defineOperation({ ...{"id":"support.accounts.read","method":"GET","path":"/api/v1/support/accounts","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(SUPPORT_QUERY_SCHEMAS.SupportAccountsReadInput, [] as const, false), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportAccountsReadOutput) })); }

export function createFetchSupportRulesRead(baseUrl: string): OperationMethod<"support.rules.read"> { return bindRulesRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindRulesRead(client: OperationExecutor): OperationMethod<"support.rules.read"> { return bindOperation(client, defineOperation({ ...{"id":"support.rules.read","method":"GET","path":"/api/v1/support/rules","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(SUPPORT_QUERY_SCHEMAS.SupportRulesReadInput, [] as const, false), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportRulesReadOutput) })); }

export function createFetchSupportRulesManage(baseUrl: string): OperationMethod<"support.rules.manage"> { return bindRulesManage(new ApiClient(baseUrl, new FetchTransport())); }

export function bindRulesManage(client: OperationExecutor): OperationMethod<"support.rules.manage"> { return bindOperation(client, defineOperation({ ...{"id":"support.rules.manage","method":"PUT","path":"/api/v1/support/rules/{ruleid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(SUPPORT_BODY_SCHEMAS.SupportRulesManageInput, ["ruleid"] as const, true), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportRulesManageOutput) })); }

export function createFetchSupportSlasRead(baseUrl: string): OperationMethod<"support.slas.read"> { return bindSlasRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindSlasRead(client: OperationExecutor): OperationMethod<"support.slas.read"> { return bindOperation(client, defineOperation({ ...{"id":"support.slas.read","method":"GET","path":"/api/v1/support/slas","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(SUPPORT_QUERY_SCHEMAS.SupportSlasReadInput, [] as const, false), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportSlasReadOutput) })); }

export function createFetchSupportSlasManage(baseUrl: string): OperationMethod<"support.slas.manage"> { return bindSlasManage(new ApiClient(baseUrl, new FetchTransport())); }

export function bindSlasManage(client: OperationExecutor): OperationMethod<"support.slas.manage"> { return bindOperation(client, defineOperation({ ...{"id":"support.slas.manage","method":"PUT","path":"/api/v1/support/slas/{slaid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(SUPPORT_BODY_SCHEMAS.SupportSlasManageInput, ["slaid"] as const, true), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportSlasManageOutput) })); }

export function createFetchSupportHistoryRead(baseUrl: string): OperationMethod<"support.history.read"> { return bindHistoryRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindHistoryRead(client: OperationExecutor): OperationMethod<"support.history.read"> { return bindOperation(client, defineOperation({ ...{"id":"support.history.read","method":"GET","path":"/api/v1/support/cases/{caseid}/history","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(SUPPORT_QUERY_SCHEMAS.SupportHistoryReadInput, ["caseid"] as const, false), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportHistoryReadOutput) })); }

export function createFetchSupportEventsRead(baseUrl: string): EventOperationMethod<"support.events.read"> { return bindEventsRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindEventsRead(client: OperationExecutor): EventOperationMethod<"support.events.read"> { return bindEventOperation(client, defineOperation({ ...{"id":"support.events.read","method":"GET","path":"/api/v1/support/events","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"stream","idempotencyPolicy":"none","idempotent":true,"timeout":15000,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","SUPPORT_EVENT_CURSOR_EXPIRED","SUPPORT_STREAM_UNAVAILABLE","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(SUPPORT_QUERY_SCHEMAS.SupportEventsReadInput, [] as const, false), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportEventsReadOutput) })); }

export function createFetchSupportReadstatesManage(baseUrl: string): OperationMethod<"support.readstates.manage"> { return bindReadstatesManage(new ApiClient(baseUrl, new FetchTransport())); }

export function bindReadstatesManage(client: OperationExecutor): OperationMethod<"support.readstates.manage"> { return bindOperation(client, defineOperation({ ...{"id":"support.readstates.manage","method":"PUT","path":"/api/v1/support/conversations/{conversationid}/readstate","audience":"public","targets":["console","storefront","miniapp","store","supplier"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(SUPPORT_BODY_SCHEMAS.SupportReadstatesManageInput, ["conversationid"] as const, true), output: exactOperationOutputFrom(SUPPORT_OUTPUT_SCHEMAS.SupportReadstatesManageOutput) })); }
