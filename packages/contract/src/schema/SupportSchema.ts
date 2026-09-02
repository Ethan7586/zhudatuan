import { array, boolean, literal, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const priority = literal(['low', 'normal', 'high', 'urgent']);
const state = literal(['open', 'assigned', 'waiting', 'resolved', 'closed']);
const channel = literal(['inapp', 'wechat', 'email', 'sms']);
const accountValidation = literal(['verified', 'notrequired', 'unverified']);
const ticket = strictObject({
  id: string(),
  scope_id: string(),
  priority,
  state,
  assigned_agent_id: nullableText,
  response_due_at: isoUtc,
  resolution_due_at: isoUtc,
  created_at: isoUtc,
  updated_at: isoUtc,
  version,
  conversation_id: string(),
  skill: string(),
});
const ticketCreated = strictObject({ ...ticket.shape, subject: string(), channel, order_id: nullableText, member_id: string() });
const ticketRead = strictObject({
  ...ticket.shape,
  member_id: nullableText,
  order_id: nullableText,
  channel,
  subject: string(),
  reference_type: nullableText,
  reference_id: nullableText,
  unread_count: unsigned,
  sla_risk: literal(['normal', 'risk', 'overdue']),
});
const message = strictObject({
  id: string(),
  clientMessageId: string(),
  conversationId: string(),
  authorType: literal(['member', 'agent']),
  authorId: string(),
  body: string(),
  sequence: unsigned,
  version,
  createdAt: isoUtc,
});
const sentMessage = strictObject({ message, ticket: strictObject({ id: string(), state, version }), conversationVersion: version });
const evidence = strictObject({
  id: string(),
  state: literal('pending'),
  upload: strictObject({ url: string(), method: literal('PUT'), headers: record(string(), string()), expiresAt: isoUtc }),
});
const visibleEvidence = strictObject({
  id: string(),
  messageId: nullableText,
  name: string(),
  contentType: string(),
  sizeBytes: unsigned,
  state: literal(['pending', 'clean', 'rejected']),
  download: optional(strictObject({ url: string(), expiresAt: isoUtc })),
  createdAt: isoUtc,
});
const supportContext = strictObject({
  member: strictObject({ id: string(), displayName: string(), employeeNo: nullableText, mobileMasked: nullableText }),
  organization: strictObject({ id: string() }),
  orders: array(strictObject({ id: string(), number: string(), state: string(), totalMinor: unsigned })),
  benefits: array(strictObject({ id: string(), state: string(), kind: string(), currency: string(), remainingMinor: unsigned, expiresAt: nullableText })),
});
const assignment = strictObject({ id: string(), ticket_id: string(), agent_id: string(), reason: string(), assigned_at: isoUtc, released_at: union([isoUtc, nullSchema()]), scope_id: string() });
const agent = strictObject({ id: string(), scope_id: string(), membership_id: string(), skills: array(string()), capacity: unsigned, state: literal(['offline', 'available', 'busy', 'disabled']), version });
const agentRead = strictObject({ id: string(), membership_id: string(), skills: array(string()), capacity: unsigned, state: literal(['offline', 'available', 'busy', 'disabled']), version });
const account = strictObject({ id: string(), scope_id: string(), provider: channel, display_name: string(), state: literal(['active', 'disabled']), validation_state: accountValidation, validation_code: string(), validated_at: union([isoUtc, nullSchema()]), version });
const accountRead = strictObject({ id: string(), provider: channel, display_name: string(), state: literal(['active', 'disabled']), validation_state: accountValidation, validation_code: string(), validated_at: union([isoUtc, nullSchema()]), version });
const rule = strictObject({ id: string(), scope_id: string(), name: string(), skill: string(), priorities: array(priority), weight: unsigned, state: literal(['active', 'disabled']), version, created_at: isoUtc, updated_at: isoUtc });
const ruleRead = strictObject({ id: string(), name: string(), skill: string(), priorities: array(priority), weight: unsigned, state: literal(['active', 'disabled']), version, updated_at: isoUtc });
const sla = strictObject({ id: string(), scope_id: string(), priority, response_seconds: unsigned, resolution_seconds: unsigned, version });
const slaRead = strictObject({ id: string(), priority, response_seconds: unsigned, resolution_seconds: unsigned, version });
const history = strictObject({ sequence: unsigned, cursor_id: string(), kind: string(), actor_id: string(), evidence: ContractJsonValueSchema, occurred_at: isoUtc });
const supportEvent = strictObject({
  id: string(),
  type: literal(['support.message.sent', 'support.ticket.updated', 'support.ticket.assigned', 'support.ticket.closed', 'support.ticket.reopened', 'support.readstate.updated', 'support.attachment.ready', 'support.attachment.rejected', 'support.sla.escalated']),
  scopeId: string(),
  ticketId: string(),
  conversationId: string(),
  messageId: optional(string()),
  evidenceId: optional(string()),
  sequence: optional(unsigned),
  version: optional(version),
  occurredAt: isoUtc,
});

export const SUPPORT_BODY_SCHEMAS = {
  SupportCasesCreateInput: strictObject({
    subject: string(),
    message: optional(string()),
    priority: optional(priority),
    channel: optional(channel),
    order: optional(string()),
    resourceType: optional(literal('benefitlot')),
    resource: optional(string()),
    skill: optional(string()),
  }),
  SupportCasesUpdateInput: strictObject({ subject: optional(string()), priority: optional(priority), state: optional(state) }),
  SupportCasesCloseInput: strictObject({}),
  SupportCasesReopenInput: strictObject({}),
  SupportMessagesSendInput: strictObject({ message: string(), clientMessageId: string(), attachmentIds: optional(array(string())) }),
  SupportAttachmentsCreateInput: strictObject({ name: string(), contentType: literal(['image/jpeg', 'image/png', 'application/pdf', 'text/plain']), sizeBytes: unsigned, sha256: string() }),
  SupportAssignmentsManageInput: strictObject({ case: string(), agent: string(), reason: string() }),
  SupportAgentsManageInput: strictObject({ membership: string(), skills: array(string()), capacity: unsigned, state: literal(['offline', 'available', 'busy', 'disabled']) }),
  SupportAccountsManageInput: strictObject({ provider: channel, displayName: string(), secretRef: optional(nullableText), state: optional(literal(['active', 'disabled'])) }),
  SupportRulesManageInput: strictObject({ name: string(), skill: string(), priorities: array(priority), weight: unsigned, state: literal(['active', 'disabled']) }),
  SupportSlasManageInput: strictObject({ priority, responseSeconds: unsigned, resolutionSeconds: unsigned }),
  SupportReadstatesManageInput: strictObject({ lastSequence: unsigned }),
} as const;
export const SUPPORT_QUERY_SCHEMAS = {
  SupportCasesReadInput: strictObject({
    ...pageQuery,
    ownership: optional(literal(['mine', 'unassigned', 'all'])),
    states: optional(array(state)),
    priorities: optional(array(priority)),
    agentId: optional(string()),
    skill: optional(string()),
    unread: optional(union([boolean(), literal(['true', 'false'])])),
    keyword: optional(string()),
    updatedAfter: optional(string()),
    updatedBefore: optional(string()),
  }),
  SupportMessagesReadInput: strictObject(pageQuery),
  SupportAgentsReadInput: strictObject(pageQuery),
  SupportAccountsReadInput: strictObject(pageQuery),
  SupportRulesReadInput: strictObject(pageQuery),
  SupportSlasReadInput: strictObject(pageQuery),
  SupportHistoryReadInput: strictObject(pageQuery),
  SupportEventsReadInput: strictObject({ conversationId: optional(string()) }),
} as const;
export const SUPPORT_OUTPUT_SCHEMAS = {
  SupportCasesCreateOutput: ticketCreated,
  SupportCasesReadOutput: pageOutput(ticketRead),
  SupportCasesUpdateOutput: ticket,
  SupportCasesCloseOutput: ticket,
  SupportCasesReopenOutput: ticket,
  SupportMessagesSendOutput: sentMessage,
  SupportMessagesReadOutput: strictObject({ items: array(message), attachments: array(visibleEvidence), context: supportContext, count: unsigned, nextCursor: optional(string()), conversationVersion: version, latestSequence: unsigned, lastReadSequence: unsigned }),
  SupportAttachmentsCreateOutput: evidence,
  SupportAssignmentsManageOutput: assignment,
  SupportAgentsManageOutput: agent,
  SupportAgentsReadOutput: pageOutput(agentRead),
  SupportAccountsManageOutput: account,
  SupportAccountsReadOutput: pageOutput(accountRead),
  SupportRulesReadOutput: pageOutput(ruleRead),
  SupportRulesManageOutput: rule,
  SupportSlasReadOutput: pageOutput(slaRead),
  SupportSlasManageOutput: sla,
  SupportHistoryReadOutput: pageOutput(history),
  SupportEventsReadOutput: supportEvent,
  SupportReadstatesManageOutput: strictObject({ conversationId: string(), lastSequence: unsigned, version }),
} as const;
