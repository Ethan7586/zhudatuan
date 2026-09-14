import { randomUUID } from 'node:crypto';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';

export class SupportJobProcessor implements JobProcessor {
  constructor(private readonly pool: DatabasePool, private readonly objects: ObjectStore,
    private readonly kind: 'supportsla' | 'supportscan') {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH'); if (signal.aborted) throw signal.reason;
    const payload = record(job.payload);
    if (this.kind === 'supportscan') return this.scan(text(payload.evidence, 'SUPPORT_EVIDENCE_REQUIRED'));
    return this.escalate(text(payload.ticket, 'SUPPORT_TICKET_REQUIRED'), phase(payload.phase));
  }

  private async scan(id: string): Promise<void> {
    const selected = await this.pool.query<{ object_ref: string; sha256: string; size_bytes: number; kind: string }>(`select object_ref,
      sha256,size_bytes::float8 size_bytes,kind from support.evidence where id=$1 and state='pending'`, [id]);
    const item = selected.rows[0]; if (!item) return; let valid = false;
    try { const metadata = await this.objects.inspect(item.object_ref); valid = metadata.sha256 === item.sha256
      && metadata.size === item.size_bytes && metadata.contentType === item.kind && metadata.size <= 10 * 1024 * 1024
      && ['image/jpeg','image/png','application/pdf','text/plain'].includes(metadata.contentType); } catch { valid = false; }
    await this.pool.query("update support.evidence set state=$2 where id=$1 and state='pending'", [id, valid ? 'clean' : 'rejected']);
  }

  private async escalate(ticket: string, reason: 'response' | 'resolution'): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const created = await client.query<{ id: string; scope_id: string; member_id: string | null }>(`with eligible as(
        select ticket.*,conversation.member_id from support.ticket ticket join support.conversation conversation
        on conversation.id=ticket.conversation_id where ticket.id=$1 and ticket.state not in('resolved','closed') and
        (($2='response' and ticket.response_due_at<=clock_timestamp() and not exists(select 1 from support.message message
          where message.conversation_id=ticket.conversation_id and message.author_type='agent')) or
        ($2='resolution' and ticket.resolution_due_at<=clock_timestamp())) for update of ticket), inserted as(
        insert into support.escalation(id,ticket_id,reason,target,state,created_at,scope_id)
        select $3,id,$2,'supervisor','open',clock_timestamp(),scope_id from eligible on conflict(ticket_id,reason) do nothing
        returning id,ticket_id) select inserted.id,eligible.scope_id,eligible.member_id from inserted
        join eligible on eligible.id=inserted.ticket_id`, [ticket, reason, `escalation:${randomUUID()}`]);
      const escalation = created.rows[0];
      if (escalation) {
        await client.query(`insert into support.history(ticket_id,sequence,kind,actor_id,evidence,occurred_at,scope_id)
          select $1,coalesce(max(sequence),0)+1,'sla.escalated','system',$2::jsonb,clock_timestamp(),$3
          from support.history where ticket_id=$1`, [ticket, JSON.stringify({ reason, escalation: escalation.id }), escalation.scope_id]);
        if (escalation.member_id) await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
          occurred_at,available_at) values($1::text,'support.sla.escalated',1,'ticket',$2::text,$3::text,
          jsonb_build_object('ticket',$2::text,'member',$4::text,'reason',$5::text,'escalation',$6::text),
          $1::text,clock_timestamp(),clock_timestamp())`,
        [`event:${randomUUID()}`, ticket, escalation.scope_id, escalation.member_id, reason, escalation.id]);
      }
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID'); return value as Record<string, unknown>;
}
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
function phase(value: unknown): 'response' | 'resolution' {
  if (value !== 'response' && value !== 'resolution') throw new Error('SUPPORT_SLA_PHASE_INVALID'); return value;
}
