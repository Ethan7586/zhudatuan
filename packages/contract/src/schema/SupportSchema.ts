import { array, literal, null as nullSchema, optional, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const priority = literal(['low', 'normal', 'high', 'urgent']);
const state = literal(['open', 'assigned', 'waiting', 'resolved', 'closed']);
const channel = literal(['inapp', 'wechat', 'email', 'sms']);
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
const ticketRead = strictObject({ ...ticket.shape, member_id: nullableText, order_id: nullableText, channel, subject: string(), reference_type: nullableText, reference_id: nullableText });
const sentMessage = strictObject({ id: string(), author_type: literal(['member', 'agent']), author_id: string(), created_at: isoUtc });
const message = strictObject({ id: string(), authorType: literal(['member', 'agent', 'system']), author: nullableText, body: string(), createdAt: isoUtc });
const evidence = strictObject({
  id: string(),
  scope_id: string(),
  conversation_id: string(),
  object_ref: string(),
  sha256: string(),
  kind: string(),
  size_bytes: unsigned,
  state: literal(['pending', 'clean', 'rejected']),
  created_at: isoUtc,
});
const visibleEvidence = strictObject({ id: string(), object_ref: string(), sha256: string(), kind: string(), size_bytes: unsigned, created_at: isoUtc });
const assignment = strictObject({ id: string(), ticket_id: string(), agent_id: string(), reason: string(), assigned_at: isoUtc, released_at: union([isoUtc, nullSchema()]), scope_id: string() });
const agent = strictObject({ id: string(), scope_id: string(), membership_id: string(), skills: array(string()), capacity: unsigned, state: literal(['offline', 'available', 'busy', 'disabled']) });
const agentRead = strictObject({ id: string(), membership_id: string(), skills: array(string()), capacity: unsigned, state: literal(['offline', 'available', 'busy', 'disabled']) });
const account = strictObject({ id: string(), scope_id: string(), channel, external_ref: string(), secret_ref: nullableText, state: literal(['active', 'disabled']), version });
const accountRead = strictObject({ id: string(), channel, external_ref: string(), state: literal(['active', 'disabled']), version });
const rule = strictObject({ id: string(), scope_id: string(), name: string(), skill: string(), priorities: array(priority), weight: unsigned, state: literal(['active', 'disabled']), version, created_at: isoUtc, updated_at: isoUtc });
const ruleRead = strictObject({ id: string(), name: string(), skill: string(), priorities: array(priority), weight: unsigned, state: literal(['active', 'disabled']), version, updated_at: isoUtc });
const sla = strictObject({ id: string(), scope_id: string(), priority, response_seconds: unsigned, resolution_seconds: unsigned, version });
const slaRead = strictObject({ id: string(), priority, response_seconds: unsigned, resolution_seconds: unsigned, version });
const history = strictObject({ sequence: unsigned, cursor_id: string(), kind: string(), actor_id: string(), evidence: ContractJsonValueSchema, occurred_at: isoUtc });

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
  SupportMessagesSendInput: strictObject({ message: string() }),
  SupportAttachmentsCreateInput: strictObject({ name: string(), data: string(), contentType: literal(['image/jpeg', 'image/png', 'application/pdf', 'text/plain']) }),
  SupportAssignmentsManageInput: strictObject({ case: string(), agent: string(), reason: string() }),
  SupportAgentsManageInput: strictObject({ membership: string(), skills: array(string()), capacity: unsigned, state: literal(['offline', 'available', 'busy', 'disabled']) }),
  SupportAccountsManageInput: strictObject({ channel, externalRef: string(), secretRef: optional(nullableText), state: optional(literal(['active', 'disabled'])) }),
  SupportRulesManageInput: strictObject({ name: string(), skill: string(), priorities: array(priority), weight: unsigned, state: literal(['active', 'disabled']) }),
  SupportSlasManageInput: strictObject({ priority, responseSeconds: unsigned, resolutionSeconds: unsigned, version }),
} as const;
export const SUPPORT_QUERY_SCHEMAS = {
  SupportCasesReadInput: strictObject(pageQuery),
  SupportMessagesReadInput: strictObject(pageQuery),
  SupportAgentsReadInput: strictObject(pageQuery),
  SupportAccountsReadInput: strictObject(pageQuery),
  SupportRulesReadInput: strictObject(pageQuery),
  SupportSlasReadInput: strictObject(pageQuery),
  SupportHistoryReadInput: strictObject(pageQuery),
} as const;
export const SUPPORT_OUTPUT_SCHEMAS = {
  SupportCasesCreateOutput: ticketCreated,
  SupportCasesReadOutput: pageOutput(ticketRead),
  SupportCasesUpdateOutput: ticket,
  SupportCasesCloseOutput: ticket,
  SupportCasesReopenOutput: ticket,
  SupportMessagesSendOutput: sentMessage,
  SupportMessagesReadOutput: strictObject({ items: array(message), attachments: array(visibleEvidence), count: unsigned, nextCursor: optional(string()) }),
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
} as const;
