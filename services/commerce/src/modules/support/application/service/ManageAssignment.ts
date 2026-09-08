import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { AssignmentPolicy } from '../../domain/policy/AssignmentPolicy';
import type { AgentStore, AssignmentRuleStore, AssignmentStore, SupportEventStore } from '../port/SupportPersistence';
import type { AssignmentRepository } from '../port/SupportRepositories';
import type { ReadSupportContext } from './ReadSupportContext';

export class ManageAssignment implements AssignmentRepository {
  private readonly policy = new AssignmentPolicy();

  constructor(
    private readonly support: ReadSupportContext,
    private readonly assignments: AssignmentStore,
    private readonly agents: AgentStore,
    private readonly rules: AssignmentRuleStore,
    private readonly events: SupportEventStore
  ) {}

  async manageAssignment(
    context: WriteTransactionContext,
    input: OperationInputFor<'support.assignments.manage'>,
    execution: ExecutionContext<'support.assignments.manage'>
  ): Promise<OperationReply<OperationOutputFor<'support.assignments.manage'>>> {
    if (execution.expectedVersion === undefined) throw new DomainError('VERSION_CONFLICT');
    const body = bodyRecord(input);
    const actor = await this.support.actor(context, execution);
    if (actor.target !== 'console') throw new DomainError('AUTHORIZATION_DENIED');
    const ticket = await this.assignments.lockTicket(context, textField(body, 'case'), actor.scopes);
    if (ticket.version !== execution.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const requested = textField(body, 'agent');
    const [candidates, rules] = await Promise.all([this.agents.candidates(context, ticket.scope), this.rules.assignmentRules(context, ticket.scope)]);
    if (!this.policy.select({ agents: candidates, rules, scope: ticket.scope, skill: ticket.skill, priority: ticket.priority }, requested)) {
      throw new DomainError('SUPPORT_AGENT_INVALID');
    }
    const assignment = await this.assignments.assign(context, {
      assignment: input.path.assignmentid,
      ticket,
      agent: requested,
      reason: textField(body, 'reason'),
      expectedVersion: execution.expectedVersion,
    });
    await this.events.history(context, ticket.id, ticket.scope, 'assigned', actor.actor, { agent: assignment.agent_id, reason: assignment.reason });
    await this.events.append(context, {
      type: 'support.ticket.assigned',
      aggregateType: 'ticket',
      aggregate: ticket.id,
      scope: ticket.scope,
      trace: execution.traceId,
      payload: { ticketId: ticket.id, conversationId: ticket.conversation, agentId: assignment.agent_id, memberId: ticket.member, version: execution.expectedVersion + 1 },
    });
    return { status: 200, headers: { etag: `"${execution.expectedVersion + 1}"` }, body: assignment };
  }
}
