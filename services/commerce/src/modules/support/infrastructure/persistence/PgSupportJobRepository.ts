import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { PendingEvidence, SupportJobRepository } from '../../application/port/SupportJobRepository';

export class PgSupportJobRepository implements SupportJobRepository {
  private readonly transactions = new PgTransactionAccess();

  async evidence(context: ReadTransactionContext, id: string): Promise<PendingEvidence | undefined> {
    const selected = await this.transactions.database(context).query<{
      object_ref: string;
      sha256: string;
      size_bytes: number;
      kind: string;
    }>(`select object_ref,sha256,size_bytes::float8 size_bytes,kind from support.evidence where id=$1 and state='pending'`, [id]);
    const row = selected.rows[0];
    return row ? Object.freeze({ objectReference: row.object_ref, sha256: row.sha256, size: row.size_bytes, contentType: row.kind }) : undefined;
  }

  async completeEvidence(context: WriteTransactionContext, id: string, clean: boolean): Promise<void> {
    await this.transactions.database(context).query(`update support.evidence set state=$2 where id=$1 and state='pending'`, [id, clean ? 'clean' : 'rejected']);
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
    if (escalation.member_id) {
      await new PgRuntimeWriter(database).append({
        id: `event:${randomUUID()}`,
        type: 'support.sla.escalated',
        aggregateType: 'ticket',
        aggregate: ticket,
        scope: escalation.scope_id,
        payload: { ticket, member: escalation.member_id, reason, escalation: escalation.id },
        trace: `supportsla:${ticket}:${reason}`,
      });
    }
  }
}
