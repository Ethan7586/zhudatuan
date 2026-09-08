import { randomUUID } from 'node:crypto';
import { isConsumerTarget, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import type { KmsClient } from '../../../../pipeline/KmsPort';
import { bodyRecord, keysetPage, queryPage, textField } from '../../../../pipeline/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { Conversation, type ConversationChannel } from '../../domain/model/Conversation';
import { Ticket, type TicketPriority, type TicketState } from '../../domain/model/Ticket';
import { AssignmentPolicy } from '../../domain/policy/AssignmentPolicy';
import type { CaseRepository, PreparedSupportOperation } from '../../application/port/SupportRepositories';
import type { SupportMessageTarget, TicketMessageStore } from '../../application/port/SupportPersistence';
import { supportBoundary } from '../../application/service/SupportBoundary';
import { SystemClock, type Clock } from '@shop/kernel';
import { Sla } from '../../domain/model/Sla';
import type { ReadSupportContext } from '../../application/service/ReadSupportContext';
import type { PgAgentRepository } from './PgAgentRepository';
import type { PgMessageRepository } from './PgMessageRepository';
import type { PgSupportConfigRepository } from './PgSupportConfigRepository';
import type { PgSupportEventRepository } from './PgSupportEventRepository';
import {
  supportBoolean as booleanValue,
  supportCaseDto as caseDto,
  supportChoice as choice,
  supportEventPayload as eventPayload,
  supportInstant as instant,
  supportMessageTargetSql as messageTargetSql,
  supportScalar as scalar,
  supportStringList as stringList,
  supportTicketDto as ticketDto,
  supportTicketPriority as ticketPriority,
  supportTicketState as ticketState,
  SUPPORT_CHANNELS as channels,
  SUPPORT_PRIORITIES as priorities,
  type PreparedSupportCase as PreparedCase,
  type SupportCaseReadRow as CaseReadRow,
  type SupportTargetRow as TargetRow,
  type SupportTicketOutputRow as TicketOutputRow,
} from './TicketRecord';

export class PgTicketQueryRepository implements TicketMessageStore {
  protected readonly transactions = new PgTransactionAccess();
  protected readonly policy = new AssignmentPolicy();

  constructor(
    protected readonly kms?: KmsClient,
    protected readonly support?: ReadSupportContext,
    protected readonly agents?: PgAgentRepository,
    protected readonly configuration?: PgSupportConfigRepository,
    protected readonly messages?: PgMessageRepository,
    protected readonly events?: PgSupportEventRepository,
    protected readonly clock: Clock = new SystemClock()
  ) {}

  async readCases(context: ReadTransactionContext, input: OperationInputFor<'support.cases.read'>, execution: ExecutionContext<'support.cases.read'>): Promise<OperationReply<OperationOutputFor<'support.cases.read'>>> {
    this.dependencies();
    const actor = await this.support!.actor(context, execution);
    const page = queryPage(input);
    const query = input.query ?? {};
    const statesFilter = stringList(query.states);
    const prioritiesFilter = stringList(query.priorities);
    const ownership = scalar(query.ownership);
    const agentFilter = scalar(query.agentId);
    const skill = scalar(query.skill);
    const keyword = scalar(query.keyword);
    const unread = booleanValue(query.unread);
    const currentAgent = actor.target === 'console' ? await this.agents!.findByMembership(context, actor.membership, actor.scopes) : null;
    const result = await this.transactions.database(context).query<CaseReadRow>(
      `select ticket.id,ticket.conversation_id,ticket.scope_id,ticket.priority,ticket.skill,ticket.state,ticket.assigned_agent_id,
      assignedagent.membership_id assigned_agent_membership_id,
      ticket.response_due_at,ticket.resolution_due_at,ticket.created_at,ticket.updated_at,ticket.version,conversation.member_id,
      conversation.order_id,conversation.channel,conversation.subject,conversation.reference_type,conversation.reference_id,
      greatest(conversation.latest_sequence-coalesce(readstate.last_sequence,0),0) unread_count,
      case when ticket.state in('resolved','closed') then 'normal'
        when ticket.resolution_due_at<=clock_timestamp() then 'overdue'
        when ticket.resolution_due_at<=clock_timestamp()+interval '30 minutes' then 'risk'
        else 'normal' end sla_risk
      from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id
      left join support.agent assignedagent on assignedagent.id=ticket.assigned_agent_id and assignedagent.scope_id=ticket.scope_id
      left join support.readstate readstate on readstate.conversation_id=conversation.id and readstate.membership_id=$3
      where ticket.scope_id=any($1::text[]) and (not $2::boolean or conversation.member_id=$4)
      and ($5::text[] is null or ticket.state=any($5::text[])) and ($6::text[] is null or ticket.priority=any($6::text[]))
      and ($7::text is null or ticket.skill=$7) and ($8::text is null or ticket.assigned_agent_id=$8)
      and ($9::text is null or ($9='mine' and ticket.assigned_agent_id=$10) or ($9='unassigned' and ticket.assigned_agent_id is null) or $9='all')
      and ($11::boolean is null or $11=(conversation.latest_sequence>coalesce(readstate.last_sequence,0)))
      and ($12::text is null or ticket.id=$12 or conversation.member_id=$12 or conversation.subject ilike '%'||$12||'%' or conversation.order_id=$12)
      and ($13::timestamptz is null or ticket.updated_at>=$13) and ($14::timestamptz is null or ticket.updated_at<=$14)
      and ($15::timestamptz is null or (ticket.updated_at,ticket.id)<($15::timestamptz,$16))
      and ($17::text is null or conversation.order_id=$17)
      order by ticket.updated_at desc,ticket.id desc limit $18`,
      [
        actor.scopes,
        isConsumerTarget(actor.target),
        actor.membership,
        actor.member,
        statesFilter,
        prioritiesFilter,
        skill,
        agentFilter,
        ownership,
        currentAgent,
        unread,
        keyword,
        scalar(query.updatedAfter),
        scalar(query.updatedBefore),
        page.sort,
        page.id,
        scalar(query.orderId),
        page.fetch,
      ]
    );
    const assignedMemberships = result.rows.flatMap(({ assigned_agent_membership_id: membership }) => (membership ? [membership] : []));
    const labels = assignedMemberships.length ? await this.support!.agentLabels(context, assignedMemberships, actor.scope) : [];
    const names = new Map(labels.map(({ membership, displayName }) => [membership, displayName]));
    const rows = result.rows.map((row) => caseDto(row, row.assigned_agent_id === null ? null : (names.get(row.assigned_agent_membership_id ?? '') ?? '客服人员')));
    const paged = keysetPage(rows, page, 'updated_at', 'id');
    return { status: 200, body: { ...paged, items: [...paged.items] } };
  }

  async readHistory(context: ReadTransactionContext, input: OperationInputFor<'support.history.read'>, execution: ExecutionContext<'support.history.read'>): Promise<OperationReply<OperationOutputFor<'support.history.read'>>> {
    this.dependencies();
    const actor = await this.support!.actor(context, execution);
    await this.readMessageTarget(context, input.path.caseid, actor.scopes, actor.member, isConsumerTarget(actor.target));
    const page = queryPage(input);
    const result = await this.transactions.database(context).query<{ sequence: number; cursor_id: string; kind: string; actor_id: string; evidence: unknown; occurred_at: string }>(
      `select sequence,sequence::text cursor_id,kind,actor_id,evidence,occurred_at from support.history
      where ticket_id=$1 and ($2::bigint is null or sequence>$2::bigint) order by sequence limit $3`,
      [input.path.caseid, page.sort, page.fetch]
    );
    const items = result.rows.map((row) => ({ ...row, sequence: Number(row.sequence), occurred_at: instant(row.occurred_at) }));
    const paged = keysetPage(items, page, 'sequence', 'cursor_id');
    return { status: 200, body: { ...paged, items: [...paged.items] } as OperationOutputFor<'support.history.read'> };
  }

  readMessageTarget(context: ReadTransactionContext, id: string, scopes: readonly string[], member: string, storefront: boolean): Promise<SupportMessageTarget> {
    return this.messageTarget(context, id, scopes, member, storefront, false);
  }

  lockMessageTarget(context: WriteTransactionContext, id: string, scopes: readonly string[], member: string, storefront: boolean): Promise<SupportMessageTarget> {
    return this.messageTarget(context, id, scopes, member, storefront, true);
  }

  async advanceMessage(context: WriteTransactionContext, ticket: Ticket, expectedVersion: number, author: 'member' | 'agent'): Promise<Readonly<{ id: string; state: TicketState; version: number }>> {
    const result = await this.transactions.database(context).query<{ id: string; state: TicketState; version: number }>(
      `update support.ticket set state=case when $3='member' then 'open' else 'waiting' end,
      updated_at=clock_timestamp(),version=version+1 where id=$1 and version=$2 and state<>'closed' returning id,state,version`,
      [ticket.id, expectedVersion, author]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ id: row.id, state: row.state, version: Number(row.version) });
  }

  private async messageTarget(context: ReadTransactionContext, id: string, scopes: readonly string[], member: string, storefront: boolean, lock: boolean): Promise<SupportMessageTarget> {
    const result = await this.transactions.database(context).query<TargetRow>(messageTargetSql(lock), [id, scopes, member, storefront]);
    const row = result.rows[0];
    if (!row) throw new DomainError('SUPPORT_TICKET_NOT_WRITABLE');
    return Object.freeze({
      ticket: new Ticket(row.id, row.conversation_id, row.scope_id, row.priority, row.state, row.assigned_agent_id, row.reopen_until === null ? null : instant(row.reopen_until), Number(row.version)),
      conversation: row.conversation_id,
      conversationVersion: Number(row.conversation_version),
      member: row.member_id,
      assignedAgent: row.assigned_agent_id,
    });
  }

  protected dependencies(): void {
    if (!this.support || !this.agents || !this.configuration || !this.messages || !this.events) throw new Error('SUPPORT_TICKET_DEPENDENCIES_REQUIRED');
  }
}
