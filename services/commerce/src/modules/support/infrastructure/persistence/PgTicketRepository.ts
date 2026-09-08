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

import { PgTicketQueryRepository } from './PgTicketQueryRepository';

export class PgTicketRepository extends PgTicketQueryRepository implements CaseRepository {
  async prepareCase(input: OperationInputFor<'support.cases.create'>, execution: ExecutionContext<'support.cases.create'>): Promise<PreparedSupportOperation> {
    if (!this.kms) throw new Error('SUPPORT_KMS_REQUIRED');
    const access = requireSession(execution.security);
    const body = bodyRecord(input);
    const ticket = `case:${randomUUID()}`;
    const conversation = `conversation:${randomUUID()}`;
    const subject = textField(body, 'subject');
    const priority = choice(body.priority ?? 'normal', priorities, 'SUPPORT_PRIORITY_INVALID') as TicketPriority;
    const channel = choice(body.channel ?? 'inapp', channels, 'SUPPORT_CHANNEL_INVALID') as ConversationChannel;
    const order = body.order === undefined ? null : textField(body, 'order');
    const reference = body.resource === undefined ? null : textField(body, 'resource');
    const referenceType = reference === null ? null : (choice(body.resourceType, ['benefitlot'], 'SUPPORT_REFERENCE_TYPE_INVALID') as 'benefitlot');
    const skill = body.skill === undefined ? 'general' : textField(body, 'skill', 64);
    const text = body.message === undefined ? null : textField(body, 'message', 4000);
    const messageId = text === null ? null : `message:${randomUUID()}`;
    const envelope = text === null ? null : await this.kms.encrypt('pii', 'support/message', text, { scope: supportBoundary(access), conversation, messageId: messageId! });
    return Object.freeze({ ticket, conversation, scope: supportBoundary(access), subject, priority, channel, order, referenceType, reference, skill, message: envelope === null ? null : Object.freeze({ id: messageId!, ...envelope }) });
  }

  async createCase(
    context: WriteTransactionContext,
    _input: OperationInputFor<'support.cases.create'>,
    execution: ExecutionContext<'support.cases.create'>,
    value: PreparedSupportOperation
  ): Promise<OperationReply<OperationOutputFor<'support.cases.create'>>> {
    this.dependencies();
    const prepared = value as PreparedCase;
    const actor = await this.support!.actor(context, execution);
    if (prepared.scope !== actor.scope) throw new DomainError('SCOPE_DENIED');
    const referenceEvidence = prepared.reference === null ? null : await this.support!.benefit(context, prepared.referenceType!, prepared.reference, actor.scope, actor.member);
    const [slaValues, candidates, rules] = await Promise.all([
      this.configuration!.resolveSla(context, actor.scope, prepared.priority),
      this.agents!.candidates(context, actor.scope),
      this.configuration!.assignmentRules(context, actor.scope),
    ]);
    const selected = this.policy.decide({ agents: candidates, rules, scope: actor.scope, skill: prepared.skill, priority: prepared.priority });
    const state: TicketState = selected ? 'assigned' : 'open';
    const openedAt = this.clock.now();
    const sla = new Sla(`resolved:${actor.scope}:${prepared.priority}`, actor.scope, prepared.priority, slaValues.response, slaValues.resolution, slaValues.reopen, 1);
    const deadlines = sla.deadlines(openedAt);
    new Conversation(prepared.conversation, actor.scope, actor.member, prepared.channel, prepared.subject, prepared.order, prepared.message ? 1 : 0, 1);
    const database = this.transactions.database(context);
    await database.query(
      `insert into support.conversation(id,scope_id,member_id,order_id,channel,subject,reference_type,reference_id,
      reference_evidence,created_at,updated_at,version,latest_sequence)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,clock_timestamp(),clock_timestamp(),1,$10)`,
      [
        prepared.conversation,
        actor.scope,
        actor.member,
        prepared.order,
        prepared.channel,
        prepared.subject,
        prepared.referenceType,
        prepared.reference,
        referenceEvidence === null ? null : JSON.stringify(referenceEvidence),
        prepared.message ? 1 : 0,
      ]
    );
    const result = await database.query<TicketOutputRow>(
      `insert into support.ticket(id,scope_id,priority,state,assigned_agent_id,response_due_at,resolution_due_at,
      created_at,updated_at,version,conversation_id,skill)
      values($1,$2,$3,$4,$5,$6,$7,$10,$10,1,$8,$9)
      returning id,scope_id,priority,state,assigned_agent_id,response_due_at,resolution_due_at,created_at,updated_at,version,conversation_id,skill`,
      [prepared.ticket, actor.scope, prepared.priority, state, selected?.id ?? null, deadlines.response, deadlines.resolution, prepared.conversation, prepared.skill, openedAt.toISOString()]
    );
    const created = result.rows[0];
    if (!created) throw new Error('SUPPORT_TICKET_CREATE_FAILED');
    new Ticket(prepared.ticket, prepared.conversation, actor.scope, prepared.priority, state, created.assigned_agent_id, null, Number(created.version));
    if (prepared.order)
      await this.support!.collaborate(context, { order: prepared.order, supportCase: prepared.ticket, scopes: actor.scopes, member: actor.member, memberOnly: isConsumerTarget(actor.target), actor: actor.actor, trace: execution.traceId });
    if (selected) {
      await database.query(
        `insert into support.assignment(id,ticket_id,agent_id,reason,assigned_at,scope_id)
        values($1,$2,$3,'policy',clock_timestamp(),$4)`,
        [`assignment:${randomUUID()}`, prepared.ticket, selected.id, actor.scope]
      );
      await database.query('update support.agent set last_assigned_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 where id=$1', [selected.id]);
      await this.events!.append(context, {
        type: 'support.ticket.assigned',
        aggregateType: 'ticket',
        aggregate: prepared.ticket,
        scope: actor.scope,
        trace: execution.traceId,
        payload: eventPayload(prepared.ticket, prepared.conversation, actor.member, { agentId: selected.id, version: 1 }),
      });
    }
    if (prepared.message) {
      await this.messages!.append(context, {
        scope: actor.scope,
        conversation: prepared.conversation,
        authorType: isConsumerTarget(actor.target) ? 'member' : 'agent',
        authorId: actor.actor,
        kind: 'text',
        visibility: 'external',
        sequence: 1,
        message: { ...prepared.message, clientMessageId: prepared.message.id, body: '' },
        attachments: [],
      });
      await this.events!.append(context, {
        type: 'support.message.sent',
        aggregateType: 'conversation',
        aggregate: prepared.conversation,
        scope: actor.scope,
        trace: execution.traceId,
        payload: eventPayload(prepared.ticket, prepared.conversation, actor.member, { messageId: prepared.message.id, sequence: 1, version: 1 }),
      });
    }
    await this.events!.history(context, prepared.ticket, actor.scope, 'opened', actor.actor, { assigned: selected?.id ?? null, priority: prepared.priority, skill: prepared.skill });
    await Promise.all([
      this.events!.enqueue(context, 'supportsla', actor.scope, { ticket: prepared.ticket, phase: 'response' }, created.response_due_at, `job:sla:response:${prepared.ticket}`),
      this.events!.enqueue(context, 'supportsla', actor.scope, { ticket: prepared.ticket, phase: 'resolution' }, created.resolution_due_at, `job:sla:resolution:${prepared.ticket}`),
    ]);
    return { status: 201, headers: { etag: '"1"' }, body: { ...ticketDto(created), subject: prepared.subject, channel: prepared.channel, order_id: prepared.order, member_id: actor.member } };
  }

  updateCase(context: WriteTransactionContext, input: OperationInputFor<'support.cases.update'>, execution: ExecutionContext<'support.cases.update'>) {
    return this.change(context, input.path.caseid, execution, 'updated', bodyRecord(input));
  }

  closeCase(context: WriteTransactionContext, input: OperationInputFor<'support.cases.close'>, execution: ExecutionContext<'support.cases.close'>) {
    return this.change(context, input.path.caseid, execution, 'closed', {});
  }

  reopenCase(context: WriteTransactionContext, input: OperationInputFor<'support.cases.reopen'>, execution: ExecutionContext<'support.cases.reopen'>) {
    return this.change(context, input.path.caseid, execution, 'open', {});
  }

  private async change(context: WriteTransactionContext, id: string, execution: ExecutionContext, kind: 'updated' | 'closed' | 'open', body: Readonly<Record<string, unknown>>) {
    this.dependencies();
    if (execution.expectedVersion === undefined) throw new DomainError('VERSION_CONFLICT');
    const actor = await this.support!.actor(context, execution);
    if (actor.target !== 'console') throw new DomainError('AUTHORIZATION_DENIED');
    const current = await this.lockMessageTarget(context, id, actor.scopes, actor.member, false);
    if (current.ticket.version !== execution.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const target = kind === 'updated' ? (body.state === undefined ? current.ticket.state : ticketState(body.state)) : kind === 'closed' ? 'closed' : 'open';
    const changedAt = this.clock.now();
    let reopenUntil = current.ticket.reopenUntil;
    if (target !== current.ticket.state) current.ticket.requireTransition(target, changedAt);
    if (target === 'closed' && current.ticket.state !== 'closed') {
      const values = await this.configuration!.resolveSla(context, current.ticket.scope, current.ticket.priority);
      reopenUntil = new Sla(`resolved:${current.ticket.scope}:${current.ticket.priority}`, current.ticket.scope, current.ticket.priority, values.response, values.resolution, values.reopen, 1).reopenUntil(changedAt);
    } else if (target === 'open') reopenUntil = null;
    const priority = body.priority === undefined ? current.ticket.priority : ticketPriority(body.priority);
    const result = await this.transactions.database(context).query<TicketOutputRow>(
      `update support.ticket set priority=$3,state=$4,reopen_until=$6,updated_at=$7,version=version+1
      where id=$1 and scope_id=$2 and version=$5 returning id,scope_id,priority,state,assigned_agent_id,response_due_at,
      resolution_due_at,created_at,updated_at,version,conversation_id,skill`,
      [id, current.ticket.scope, priority, target, execution.expectedVersion, reopenUntil, changedAt.toISOString()]
    );
    const updated = result.rows[0];
    if (!updated) throw new DomainError('VERSION_CONFLICT');
    if (body.subject !== undefined)
      await this.transactions.database(context).query('update support.conversation set subject=$2,updated_at=clock_timestamp(),version=version+1 where id=$1', [current.conversation, textField(body, 'subject')]);
    const eventType = kind === 'closed' ? 'support.ticket.closed' : kind === 'open' ? 'support.ticket.reopened' : 'support.ticket.updated';
    await this.events!.history(context, id, current.ticket.scope, kind === 'open' ? 'reopened' : kind, actor.actor, { priority, state: target, subject: body.subject ?? null });
    await this.events!.append(context, {
      type: eventType,
      aggregateType: 'ticket',
      aggregate: id,
      scope: current.ticket.scope,
      trace: execution.traceId,
      payload: eventPayload(id, current.conversation, current.member, { version: Number(updated.version) }),
    });
    return { status: 200, headers: { etag: `"${Number(updated.version)}"` }, body: ticketDto(updated) };
  }
}
