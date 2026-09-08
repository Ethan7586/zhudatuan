import { COMMERCE_EVENTS } from '@shop/contract';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { EventReplayPort } from '../../../runtime/public';
import type { DurableSupportEvent, SupportRealtimeEvent, SupportReplayBatch, SupportReplayPort } from '../../application/port/RealtimePort';

const types: ReadonlySet<string> = new Set(COMMERCE_EVENTS.filter(({ module }) => module === 'support').map(({ type }) => type));

interface MessageTruth {
  readonly message_id: string;
  readonly ticket_id: string;
  readonly conversation_id: string;
  readonly member_id: string | null;
  readonly sequence: number;
  readonly visibility: 'external' | 'internal';
}

export class PgSupportReplayRepository implements SupportReplayPort {
  private readonly transactions = new PgTransactionAccess();

  constructor(private readonly runtime: EventReplayPort) {}

  async authoritative(context: WriteTransactionContext, event: DurableSupportEvent): Promise<SupportRealtimeEvent> {
    const messageId = text(event.payload.messageId);
    const truth = event.type === 'support.message.sent' && messageId ? await this.message(context, messageId, event.scope) : null;
    if (event.type === 'support.message.sent' && !truth) throw new Error('SUPPORT_MESSAGE_EVENT_TRUTH_MISSING');
    if (truth) await this.assertRelayOrder(context, event.id, truth);
    return mapEvent(event.id, event.type, event.version, event.scope, event.aggregate, event.payload, event.occurredAt, truth);
  }

  async replay(context: ReadTransactionContext, input: Readonly<{ scopes: readonly string[]; member: string; storefront: boolean; conversation: string | null; cursor: string }>): Promise<SupportReplayBatch> {
    const page = await this.runtime.after(context, { cursor: input.cursor, scopes: input.scopes, prefix: 'support.', limit: RUNTIME_LIMITS.stream.retentionEvents });
    if (!page || page.overflow) throw new DomainError('SUPPORT_EVENT_CURSOR_EXPIRED');
    const messageIds = distinct(page.events.filter(({ type }) => type === 'support.message.sent').flatMap(({ payload }) => (text(payload.messageId) ? [text(payload.messageId)!] : [])));
    const truths = new Map((await this.messages(context, messageIds, input.scopes)).map((truth) => [truth.message_id, truth]));
    const mapped = page.events.map((event) =>
      mapEvent(event.cursor, event.type, event.version, event.scope, event.aggregate, event.payload, event.occurredAt, text(event.payload.messageId) ? (truths.get(text(event.payload.messageId)!) ?? null) : null)
    );
    const visible = mapped.filter((event) => (!input.conversation || event.conversationId === input.conversation) && (!input.storefront || event.memberId === input.member));
    visible.sort((left, right) =>
      left.conversationId === right.conversationId && left.sequence !== undefined && right.sequence !== undefined
        ? left.sequence - right.sequence || left.id.localeCompare(right.id)
        : Date.parse(left.occurredAt) - Date.parse(right.occurredAt) || left.id.localeCompare(right.id)
    );
    return Object.freeze({ events: Object.freeze(visible), resumeCursor: page.resumeCursor });
  }

  private async message(context: ReadTransactionContext, id: string, scope: string): Promise<MessageTruth | null> {
    const result = await this.transactions.database(context).query<MessageTruth>(
      `select message.id message_id,ticket.id ticket_id,message.conversation_id,conversation.member_id,message.sequence,message.visibility
      from support.message message join support.conversation conversation on conversation.id=message.conversation_id
      join support.ticket ticket on ticket.conversation_id=message.conversation_id
      where message.id=$1 and message.scope_id=$2`,
      [id, scope]
    );
    return result.rows[0] ?? null;
  }

  private async messages(context: ReadTransactionContext, ids: readonly string[], scopes: readonly string[]): Promise<readonly MessageTruth[]> {
    if (ids.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<MessageTruth>(
      `select message.id message_id,ticket.id ticket_id,message.conversation_id,conversation.member_id,message.sequence,message.visibility
      from support.message message join support.conversation conversation on conversation.id=message.conversation_id
      join support.ticket ticket on ticket.conversation_id=message.conversation_id
      where message.id=any($1::text[]) and message.scope_id=any($2::text[]) order by message.id`,
      [ids, scopes]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  private async assertRelayOrder(context: ReadTransactionContext, event: string, truth: MessageTruth): Promise<void> {
    const result = await this.transactions.database(context).query<{ id: string }>(`select id from support.message where conversation_id=$1 and sequence<$2 order by sequence,id`, [truth.conversation_id, truth.sequence]);
    const references = result.rows.map(({ id }) => id);
    const published = await this.runtime.publishedReferences(context, { type: 'support.message.sent', field: 'messageId', references, excluding: event });
    if (new Set(published).size !== references.length) throw new Error('SUPPORT_MESSAGE_RELAY_ORDER_PENDING');
  }
}

function distinct(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function mapEvent(id: string, type: string, version: number, scope: string, aggregate: string, payload: Readonly<Record<string, unknown>>, occurredAt: string, truth: MessageTruth | null): SupportRealtimeEvent {
  if (!types.has(type)) throw new Error('SUPPORT_REPLAY_EVENT_UNDECLARED');
  const messageId = text(payload.messageId);
  return Object.freeze({
    id,
    type: type as SupportRealtimeEvent['type'],
    scopeId: scope,
    ticketId: truth?.ticket_id ?? text(payload.ticketId) ?? aggregate,
    conversationId: truth?.conversation_id ?? text(payload.conversationId) ?? aggregate,
    ...((truth ? (truth.visibility === 'external' ? truth.member_id : null) : text(payload.memberId)) === null ? {} : { memberId: truth ? truth.member_id! : text(payload.memberId)! }),
    ...(messageId === null ? {} : { messageId }),
    ...(text(payload.evidenceId) === null ? {} : { evidenceId: text(payload.evidenceId)! }),
    ...(truth ? { sequence: Number(truth.sequence) } : Number.isSafeInteger(payload.sequence) ? { sequence: Number(payload.sequence) } : {}),
    ...(Number.isSafeInteger(payload.version) ? { version: Number(payload.version) } : { version }),
    occurredAt: new Date(occurredAt).toISOString(),
  });
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
