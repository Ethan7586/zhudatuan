import type { OperationOutputFor } from '@shop/contract';
import type { AgentPage } from '../model/Agent';
import type { ConversationPage } from '../model/Message';
import type { HistoryPage } from '../model/History';
import type { Account, ConfigPage, Rule, Sla } from '../model/SupportConfig';
import type { SupportEvent } from '../model/SupportEvent';
import type { Ticket, TicketPage } from '../model/Ticket';

type TicketDto = OperationOutputFor<'support.cases.read'>['items'][number];

export class SupportMapper {
  ticketPage(value: OperationOutputFor<'support.cases.read'>): TicketPage {
    return freezePage(value, (item) => this.ticket(item));
  }

  conversation(value: OperationOutputFor<'support.messages.read'>): ConversationPage {
    return Object.freeze({
      items: Object.freeze(value.items.map((item) => Object.freeze({ ...item }))),
      attachments: Object.freeze(
        value.attachments.map((item) =>
          Object.freeze({
            id: item.id,
            messageId: item.messageId,
            name: item.name,
            contentType: item.contentType,
            sizeBytes: item.sizeBytes,
            state: item.state,
            createdAt: item.createdAt,
            ...(item.download ? { download: Object.freeze({ ...item.download }) } : {}),
          })
        )
      ),
      context: Object.freeze({
        member: Object.freeze({ ...value.context.member }),
        organization: Object.freeze({ ...value.context.organization }),
        orders: Object.freeze(value.context.orders.map((item) => Object.freeze({ ...item }))),
        benefits: Object.freeze(value.context.benefits.map((item) => Object.freeze({ ...item }))),
      }),
      count: value.count,
      conversationVersion: value.conversationVersion,
      latestSequence: value.latestSequence,
      lastReadSequence: value.lastReadSequence,
      ...(value.nextCursor ? { nextCursor: value.nextCursor } : {}),
    });
  }

  history(value: OperationOutputFor<'support.history.read'>): HistoryPage {
    return freezePage(value, (item) => Object.freeze({ sequence: item.sequence, cursorId: item.cursor_id, kind: item.kind, actorId: item.actor_id, occurredAt: item.occurred_at }));
  }

  agents(value: OperationOutputFor<'support.agents.read'>): AgentPage {
    return freezePage(value, (item) => Object.freeze({ id: item.id, membershipId: item.membership_id, skills: Object.freeze([...item.skills]), capacity: item.capacity, state: item.state, version: item.version }));
  }

  accounts(value: OperationOutputFor<'support.accounts.read'>): ConfigPage<Account> {
    return freezePage(value, (item) =>
      Object.freeze({
        id: item.id,
        provider: item.provider,
        displayName: item.display_name,
        state: item.state,
        validationState: item.validation_state,
        validationCode: item.validation_code,
        validatedAt: item.validated_at,
        version: item.version,
      })
    );
  }

  rules(value: OperationOutputFor<'support.rules.read'>): ConfigPage<Rule> {
    return freezePage(value, (item) =>
      Object.freeze({ id: item.id, name: item.name, skill: item.skill, priorities: Object.freeze([...item.priorities]), weight: item.weight, state: item.state, version: item.version, updatedAt: item.updated_at })
    );
  }

  slas(value: OperationOutputFor<'support.slas.read'>): ConfigPage<Sla> {
    return freezePage(value, (item) => Object.freeze({ id: item.id, priority: item.priority, responseSeconds: item.response_seconds, resolutionSeconds: item.resolution_seconds, version: item.version }));
  }

  event(value: OperationOutputFor<'support.events.read'>): SupportEvent {
    return Object.freeze({
      id: value.id,
      type: value.type,
      scopeId: value.scopeId,
      ticketId: value.ticketId,
      conversationId: value.conversationId,
      occurredAt: value.occurredAt,
      ...(value.messageId ? { messageId: value.messageId } : {}),
      ...(value.evidenceId ? { evidenceId: value.evidenceId } : {}),
      ...(value.sequence !== undefined ? { sequence: value.sequence } : {}),
      ...(value.version !== undefined ? { version: value.version } : {}),
    });
  }

  private ticket(value: TicketDto): Ticket {
    return Object.freeze({
      id: value.id,
      priority: value.priority,
      state: value.state,
      assignedAgentId: value.assigned_agent_id,
      responseDueAt: value.response_due_at,
      resolutionDueAt: value.resolution_due_at,
      createdAt: value.created_at,
      updatedAt: value.updated_at,
      version: value.version,
      conversationId: value.conversation_id,
      skill: value.skill,
      memberId: value.member_id,
      orderId: value.order_id,
      channel: value.channel,
      subject: value.subject,
      referenceType: value.reference_type,
      referenceId: value.reference_id,
      unreadCount: value.unread_count,
      slaRisk: value.sla_risk,
    });
  }
}

function freezePage<TDto, TModel>(value: Readonly<{ items: readonly TDto[]; count: number; nextCursor?: string | undefined }>, map: (item: TDto) => TModel): Readonly<{ items: readonly TModel[]; count: number; nextCursor?: string }> {
  return Object.freeze({ items: Object.freeze(value.items.map(map)), count: value.count, ...(value.nextCursor ? { nextCursor: value.nextCursor } : {}) });
}
