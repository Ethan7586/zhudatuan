import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { PendingEvidence, SupportJobRepository } from '../../application/port/SupportJobRepository';
import { AssignmentRule } from '../../domain/model/AssignmentRule';
import type { TicketPriority } from '../../domain/model/Ticket';
import { AssignmentPolicy, type Agent } from '../../domain/policy/AssignmentPolicy';

export class PgSupportJobRepository implements SupportJobRepository {
  private readonly transactions = new PgTransactionAccess();

  async evidence(context: ReadTransactionContext, id: string): Promise<PendingEvidence | undefined> {
    const selected = await this.transactions.database(context).query<{
      object_ref: string;
      sha256: string;
      size_bytes: number;
      kind: string;
      original_name: string;
      upload_expires_at: string;
      scope_id: string;
      conversation_id: string;
      ticket_id: string;
    }>(
      `select evidence.object_ref,evidence.sha256,evidence.size_bytes::float8 size_bytes,evidence.kind,
      evidence.original_name,evidence.upload_expires_at,evidence.scope_id,evidence.conversation_id,ticket.id ticket_id
      from support.evidence evidence join support.ticket ticket on ticket.conversation_id=evidence.conversation_id
      where evidence.id=$1 and evidence.state='pending'`, [id]
    );
    const row = selected.rows[0];
    return row ? Object.freeze({ id, objectReference: row.object_ref, sha256: row.sha256, size: Number(row.size_bytes), contentType: row.kind, originalName: row.original_name, uploadExpiresAt: new Date(row.upload_expires_at).toISOString(), scope: row.scope_id, ticket: row.ticket_id, conversation: row.conversation_id }) : undefined;
  }

  async completeEvidence(context: WriteTransactionContext, evidence: PendingEvidence, clean: boolean, reason: string | null): Promise<void> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `update support.evidence set state=$2,uploaded_at=coalesce(uploaded_at,clock_timestamp()),scanned_at=clock_timestamp(),
      scan_reason=$3,version=version+1 where id=$1 and state='pending'`,
      [evidence.id, clean ? 'clean' : 'rejected', reason]
    );
    if (result.rowCount !== 1) return;
    await this.append(database, clean ? 'support.attachment.ready' : 'support.attachment.rejected', 'evidence', evidence.id, evidence.scope, {
      ticketId: evidence.ticket, conversationId: evidence.conversation, evidenceId: evidence.id, version: 2,
    }, `supportscan:${evidence.id}`);
  }

  async escalate(context: WriteTransactionContext, ticket: string, reason: 'response' | 'resolution'): Promise<void> {
    const database = this.transactions.database(context);
    const created = await database.query<{ id: string; scope_id: string; member_id: string | null }>(
      `with eligible as(
      select ticket.id,ticket.scope_id,conversation.member_id from support.ticket ticket join support.conversation conversation
      on conversation.id=ticket.conversation_id where ticket.id=$1 and ticket.state not in('resolved','closed') and
      (($2='response' and ticket.response_due_at<=clock_timestamp() and not exists(select 1 from support.message message
        where message.conversation_id=ticket.conversation_id and message.author_type='agent')) or
      ($2='resolution' and ticket.resolution_due_at<=clock_timestamp())) for update of ticket), inserted as(
      insert into support.escalation(id,ticket_id,reason,target,state,created_at,scope_id)
      select $3,id,$2,'supervisor','open',clock_timestamp(),scope_id from eligible on conflict(ticket_id,reason) do nothing
      returning id,ticket_id) select inserted.id,eligible.scope_id,eligible.member_id from inserted
      join eligible on eligible.id=inserted.ticket_id`,
      [ticket, reason, `escalation:${randomUUID()}`]
    );
    const escalation = created.rows[0];
    if (!escalation) return;
    await database.query(
      `insert into support.history(ticket_id,sequence,kind,actor_id,evidence,occurred_at,scope_id)
      select $1,coalesce(max(sequence),0)+1,'sla.escalated','system',$2::jsonb,clock_timestamp(),$3
      from support.history where ticket_id=$1`,
      [ticket, JSON.stringify({ reason, escalation: escalation.id }), escalation.scope_id]
    );
    const conversation = await database.query<{ conversation_id: string }>('select conversation_id from support.ticket where id=$1', [ticket]);
    await this.append(database, 'support.sla.escalated', 'ticket', ticket, escalation.scope_id, {
      ticketId: ticket, conversationId: conversation.rows[0]?.conversation_id ?? ticket,
      ...(escalation.member_id === null ? {} : { memberId: escalation.member_id }), reason, escalationId: escalation.id,
    }, `supportsla:${ticket}:${reason}`);
  }

  async reassign(context: WriteTransactionContext, agent: string, cursor: string | null): Promise<void> {
    const database = this.transactions.database(context);
    const disabled = await database.query<{ scope_id: string }>(`select scope_id from support.agent where id=$1 and state='disabled'`, [agent]);
    const scope = disabled.rows[0]?.scope_id;
    if (!scope) return;
    const tickets = await database.query<{ id: string; conversation_id: string; member_id: string | null; priority: TicketPriority; skill: string; version: number }>(
      `select ticket.id,ticket.conversation_id,conversation.member_id,ticket.priority,ticket.skill,ticket.version
      from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id
      where ticket.assigned_agent_id=$1 and ticket.scope_id=$2 and ticket.state in('assigned','waiting')
      and ($3::text is null or ticket.id>$3) order by ticket.id for update of ticket skip locked limit 50`, [agent, scope, cursor]
    );
    if (tickets.rows.length === 0) return;
    const [candidateRows, ruleRows] = await Promise.all([
      database.query<{ id: string; state: Agent['state']; skills: string[]; capacity: number; load: number; last_assigned_at: string | null }>(
        `select target.id,target.state,target.skills,target.capacity,target.last_assigned_at,
        count(ticket.id) filter(where ticket.state in('assigned','waiting'))::integer load
        from support.agent target left join support.ticket ticket on ticket.assigned_agent_id=target.id
        where target.scope_id=$1 and target.state='available' group by target.id order by target.id`, [scope]
      ),
      database.query<{ id: string; scope_id: string; skill: string; priorities: TicketPriority[]; weight: number }>(
        `select id,scope_id,skill,priorities,weight from support.assignmentrule where scope_id=$1 and state='active' order by weight desc,id`, [scope]
      ),
    ]);
    let candidates: readonly Agent[] = candidateRows.rows.map((row) => ({ id: row.id, online: true, state: row.state, load: Number(row.load), capacity: Number(row.capacity), skills: row.skills, scopes: [scope], lastAssignedAt: row.last_assigned_at }));
    const rules = ruleRows.rows.map((row) => new AssignmentRule(row.id, row.scope_id, row.skill, row.priorities, Number(row.weight), true));
    const policy = new AssignmentPolicy();
    for (const ticket of tickets.rows) {
      await database.query('select id from support.assignment where ticket_id=$1 and released_at is null for update', [ticket.id]);
      const selected = policy.decide({ agents: candidates, rules, scope, skill: ticket.skill, priority: ticket.priority });
      await database.query('update support.assignment set released_at=clock_timestamp() where ticket_id=$1 and released_at is null', [ticket.id]);
      if (selected) await database.query(`insert into support.assignment(id,ticket_id,agent_id,reason,assigned_at,scope_id) values($1,$2,$3,'agent-disabled',clock_timestamp(),$4)`, [`assignment:${randomUUID()}`, ticket.id, selected.id, scope]);
      const updated = await database.query(
        `update support.ticket set assigned_agent_id=$2,state=$3,updated_at=clock_timestamp(),version=version+1 where id=$1 and version=$4`,
        [ticket.id, selected?.id ?? null, selected ? 'assigned' : 'open', ticket.version]
      );
      if (updated.rowCount !== 1) throw new Error('SUPPORT_REASSIGN_VERSION_CONFLICT');
      await database.query(
        `insert into support.history(ticket_id,sequence,kind,actor_id,evidence,occurred_at,scope_id)
        select $1,coalesce(max(sequence),0)+1,$2,'system',$3::jsonb,clock_timestamp(),$4 from support.history where ticket_id=$1`,
        [ticket.id, selected ? 'reassigned' : 'unassigned', JSON.stringify({ disabledAgent: agent, assigned: selected?.id ?? null }), scope]
      );
      await this.append(database, 'support.ticket.assigned', 'ticket', ticket.id, scope, { ticketId: ticket.id, conversationId: ticket.conversation_id, memberId: ticket.member_id, agentId: selected?.id ?? null, version: Number(ticket.version) + 1 }, `supportreassign:${ticket.id}`);
      if (selected) candidates = candidates.map((item) => item.id === selected.id ? { ...item, load: item.load + 1, lastAssignedAt: new Date().toISOString() } : item);
    }
    if (tickets.rows.length === 50) {
      const next = tickets.rows.at(-1)!.id;
      await new PgRuntimeWriter(database).schedule({ id: `job:reassign:${agent}:${next}`, kind: 'supportreassign', owner: 'support', scope, payload: { agent, cursor: next }, priority: 10 });
    }
  }

  private async append(database: ReturnType<PgTransactionAccess['database']>, type: string, aggregateType: string, aggregate: string, scope: string, payload: Readonly<Record<string, unknown>>, trace: string): Promise<void> {
    const writer = new PgRuntimeWriter(database);
    const id = `event:${randomUUID()}`;
    await writer.append({ id, type, aggregateType, aggregate, scope, payload, trace });
    await writer.schedule({ id: `job:relay:${id}`, kind: 'supportrelay', owner: 'support', scope, payload: { event: id }, priority: 20 });
  }
}
