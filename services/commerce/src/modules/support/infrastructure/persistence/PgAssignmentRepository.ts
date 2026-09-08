import { randomUUID } from 'node:crypto';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { TicketPriority, TicketState } from '../../domain/model/Ticket';
import type { AssignmentRecord, AssignmentStore, AssignmentTicket } from '../../application/port/SupportPersistence';

export class PgAssignmentRepository implements AssignmentStore {
  private readonly transactions = new PgTransactionAccess();

  async lockTicket(context: WriteTransactionContext, ticket: string, scopes: readonly string[]): Promise<AssignmentTicket> {
    const result = await this.transactions.database(context).query<{
      id: string;
      conversation_id: string;
      scope_id: string;
      skill: string;
      priority: TicketPriority;
      state: TicketState;
      version: number;
      member_id: string | null;
    }>(
      `select ticket.id,ticket.conversation_id,ticket.scope_id,ticket.skill,ticket.priority,ticket.state,ticket.version,
      conversation.member_id from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id
      where ticket.id=$1 and ticket.scope_id=any($2::text[]) for update of ticket`,
      [ticket, scopes]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze({ id: row.id, conversation: row.conversation_id, scope: row.scope_id, skill: row.skill, priority: row.priority, state: row.state, version: Number(row.version), member: row.member_id });
  }

  async assign(context: WriteTransactionContext, input: Readonly<{ assignment: string; ticket: AssignmentTicket; agent: string; reason: string; expectedVersion: number }>): Promise<AssignmentRecord> {
    const database = this.transactions.database(context);
    const current = await database.query('select id from support.assignment where ticket_id=$1 and released_at is null for update', [input.ticket.id]);
    const agent = await database.query<{ id: string }>(
      `select agent.id from support.agent agent where agent.id=$1 and agent.scope_id=$2 and agent.state='available'
      and $3=any(agent.skills) and (select count(*) from support.ticket load where load.assigned_agent_id=agent.id and load.state in('assigned','waiting'))<agent.capacity
      for update`,
      [input.agent, input.ticket.scope, input.ticket.skill]
    );
    if (!agent.rows[0]) throw new DomainError('SUPPORT_AGENT_INVALID');
    if (current.rows[0]) await database.query('update support.assignment set released_at=clock_timestamp() where id=$1 and released_at is null', [current.rows[0].id]);
    const updated = await database.query(
      `update support.ticket set assigned_agent_id=$2,state='assigned',updated_at=clock_timestamp(),version=version+1
      where id=$1 and version=$3 and state<>'closed' returning id`,
      [input.ticket.id, input.agent, input.expectedVersion]
    );
    if (!updated.rows[0]) throw new DomainError('VERSION_CONFLICT');
    const result = await database.query<AssignmentRecord>(
      `insert into support.assignment(id,ticket_id,agent_id,reason,assigned_at,scope_id)
      values($1,$2,$3,$4,clock_timestamp(),$5)
      returning id,ticket_id,agent_id,reason,assigned_at,released_at,scope_id`,
      [input.assignment || `assignment:${randomUUID()}`, input.ticket.id, input.agent, input.reason, input.ticket.scope]
    );
    await database.query('update support.agent set last_assigned_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 where id=$1', [input.agent]);
    const row = result.rows[0];
    if (!row) throw new Error('SUPPORT_ASSIGNMENT_CREATE_FAILED');
    return Object.freeze({ ...row, assigned_at: new Date(row.assigned_at).toISOString(), released_at: row.released_at ? new Date(row.released_at).toISOString() : null });
  }
}
