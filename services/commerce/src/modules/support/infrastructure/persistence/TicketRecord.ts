import { DomainError } from '../../../../platform/error/DomainError';
import type { ConversationChannel } from '../../domain/model/Conversation';
import type { TicketPriority, TicketState } from '../../domain/model/Ticket';

export interface SupportTargetRow {
  readonly id: string;
  readonly conversation_id: string;
  readonly scope_id: string;
  readonly priority: TicketPriority;
  readonly state: TicketState;
  readonly version: number;
  readonly assigned_agent_id: string | null;
  readonly reopen_until: string | null;
  readonly member_id: string | null;
  readonly conversation_version: number;
}

export interface SupportTicketOutputRow {
  readonly id: string;
  readonly scope_id: string;
  readonly priority: TicketPriority;
  readonly state: TicketState;
  readonly assigned_agent_id: string | null;
  readonly response_due_at: string;
  readonly resolution_due_at: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
  readonly conversation_id: string;
  readonly skill: string;
}

export interface SupportCaseReadRow extends SupportTicketOutputRow {
  readonly assigned_agent_membership_id: string | null;
  readonly member_id: string | null;
  readonly order_id: string | null;
  readonly channel: ConversationChannel;
  readonly subject: string;
  readonly reference_type: string | null;
  readonly reference_id: string | null;
  readonly unread_count: number;
  readonly sla_risk: 'normal' | 'risk' | 'overdue';
}

export const SUPPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const SUPPORT_CHANNELS = ['inapp', 'wechat', 'email', 'sms'] as const;
const STATES = ['open', 'assigned', 'waiting', 'resolved', 'closed'] as const;

export interface PreparedSupportCase {
  readonly ticket: string;
  readonly conversation: string;
  readonly scope: string;
  readonly subject: string;
  readonly priority: TicketPriority;
  readonly channel: ConversationChannel;
  readonly order: string | null;
  readonly referenceType: 'benefitlot' | null;
  readonly reference: string | null;
  readonly skill: string;
  readonly message: null | Readonly<{ id: string; ciphertext: string; fingerprint: string; keyVersion: string }>;
}

export function supportMessageTargetSql(lock: boolean): string {
  return `select ticket.id,ticket.conversation_id,ticket.scope_id,ticket.priority,ticket.state,ticket.version,
  ticket.assigned_agent_id,conversation.member_id,conversation.version conversation_version
  ,ticket.reopen_until
  from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id
  where ticket.id=$1 and ticket.scope_id=any($2::text[]) and (not $4::boolean or conversation.member_id=$3)
  ${lock ? 'for update of ticket,conversation' : ''}`;
}

export function supportInstant(value: string | Date): string {
  return new Date(value).toISOString();
}
export function supportTicketDto(row: SupportTicketOutputRow) {
  return {
    id: row.id,
    scope_id: row.scope_id,
    priority: row.priority,
    state: row.state,
    assigned_agent_id: row.assigned_agent_id,
    conversation_id: row.conversation_id,
    skill: row.skill,
    version: Number(row.version),
    response_due_at: supportInstant(row.response_due_at),
    resolution_due_at: supportInstant(row.resolution_due_at),
    created_at: supportInstant(row.created_at),
    updated_at: supportInstant(row.updated_at),
  };
}
export function supportCaseDto(row: SupportCaseReadRow, assignedAgentName: string | null) {
  return {
    ...supportTicketDto(row),
    assigned_agent_name: assignedAgentName,
    member_id: row.member_id,
    order_id: row.order_id,
    channel: row.channel,
    subject: row.subject,
    reference_type: row.reference_type,
    reference_id: row.reference_id,
    unread_count: Number(row.unread_count),
    sla_risk: row.sla_risk,
  };
}
export function supportChoice(value: unknown, values: readonly string[], code: string): string {
  if (typeof value !== 'string' || !values.includes(value)) throw new Error(code);
  return value;
}
export function supportTicketState(value: unknown): TicketState {
  return supportChoice(value, STATES, 'SUPPORT_STATE_INVALID') as TicketState;
}
export function supportTicketPriority(value: unknown): TicketPriority {
  return supportChoice(value, SUPPORT_PRIORITIES, 'SUPPORT_PRIORITY_INVALID') as TicketPriority;
}
export function supportScalar(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
export function supportStringList(value: unknown): string[] | null {
  if (value === undefined) return null;
  const values = Array.isArray(value) ? value : [value];
  return values.map(String);
}
export function supportBoolean(value: unknown): boolean | null {
  if (value === undefined) return null;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new DomainError('VALIDATION_FAILED');
}
export function supportEventPayload(ticketId: string, conversationId: string, memberId: string | null, extra: Readonly<Record<string, unknown>>) {
  return { ticketId, conversationId, memberId, ...extra };
}
