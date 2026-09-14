import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { AssignmentRule } from '../../02_domain_yewu/model/AssignmentRule';
import type { TicketPriority } from '../../02_domain_yewu/model/Ticket';
import type { Agent } from '../../02_domain_yewu/policy/AssignmentPolicy';
import { Message } from '../../02_domain_yewu/model/Message';
import type { EncryptedMessage, SlaPolicy, SupportPort } from '../../01_public_gongkai/SupportPort';
import type { GetOrderSummary } from '../../../order_dingdan';

export class PgSupportRepository implements SupportPort {
  constructor(private readonly database: OperationDatabase, private readonly orders: GetOrderSummary) {}

  async member(membership: string): Promise<string> {
    const result = await this.database.query<{ member_id: string }>('select member_id from access.membership where id=$1', [membership]);
    if (!result.rows[0]) throw new Error('MEMBERSHIP_NOT_FOUND'); return result.rows[0].member_id;
  }

  async assertOrder(order: string, scope: string, member: string, memberOnly: boolean): Promise<void> {
    if (!await this.orders.execute(this.database, order, scope, member, memberOnly)) throw new Error('SUPPORT_ORDER_SCOPE_INVALID');
  }

  async benefit(type: string, id: string, scope: string, member: string): Promise<Readonly<Record<string, unknown>>> {
    if (type !== 'benefitlot') throw new Error('SUPPORT_REFERENCE_TYPE_INVALID');
    const result = await this.database.query(`select lot.id,lot.batch_id,lot.total_minor,lot.remaining_minor,lot.state,lot.effective_at,
      lot.expires_at,account.kind,account.currency from benefit.lot lot join benefit.account account on account.id=lot.account_id
      where lot.id=$1 and lot.member_id=$2 and exists(select 1 from organization.unitclosure where ancestor_id=$3
      and descendant_id=account.scope_id)`, [id, member, scope]);
    if (!result.rows[0]) throw new Error('SUPPORT_BENEFIT_REFERENCE_INVALID'); return result.rows[0]!;
  }

  async agents(scope: string): Promise<readonly Agent[]> {
    const result = await this.database.query<{ id: string; skills: string[]; capacity: number; load: number }>(`select agent.id,
      agent.skills,agent.capacity,count(ticket.id) filter(where ticket.state in('assigned','waiting'))::integer load
      from support.agent agent left join support.ticket ticket on ticket.assigned_agent_id=agent.id where agent.scope_id=$1
      and agent.state='available' group by agent.id having count(ticket.id) filter(where ticket.state in('assigned','waiting'))<agent.capacity`, [scope]);
    return result.rows.map((row) => ({ id: row.id, online: true, load: row.load, skills: row.skills, scopes: [scope] }));
  }

  async rules(scope: string): Promise<readonly AssignmentRule[]> {
    const result = await this.database.query<{ id: string; scope_id: string; skill: string; priorities: TicketPriority[];
      weight: number; state: string }>(`select id,scope_id,skill,priorities,weight,state from support.assignmentrule
      where scope_id=$1 and state='active' order by weight desc,id`, [scope]);
    return result.rows.map((row) => new AssignmentRule(row.id, row.scope_id, row.skill, row.priorities, row.weight, true));
  }

  async sla(scope: string, priority: TicketPriority): Promise<SlaPolicy | null> {
    const result = await this.database.query<{ response_seconds: number; resolution_seconds: number }>(`select sla.response_seconds,
      sla.resolution_seconds from organization.unitclosure closure join support.sla sla on sla.scope_id=closure.ancestor_id
      and sla.priority=$2::text where closure.descendant_id=$1::text order by closure.depth asc,sla.version desc limit 1`, [scope, priority]);
    const policy = result.rows[0];
    return policy ? { response: policy.response_seconds, resolution: policy.resolution_seconds } : null;
  }

  async message(ticket: string, conversation: string, scope: string, author: 'member' | 'agent', actor: string,
    message: EncryptedMessage) {
    const result = await this.database.query<{ id: string; author_type: 'member' | 'agent'; author_id: string; created_at: string }>(`insert into support.message(id,scope_id,conversation_id,author_type,author_id,body_ciphertext,
      body_hash,body_key_version,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp()) returning id,author_type,author_id,created_at`,
    [message.id, scope, conversation, author, actor, message.ciphertext, message.fingerprint, message.keyVersion]);
    const appended = result.rows[0];
    if (!appended) throw new Error('SUPPORT_MESSAGE_APPEND_FAILED');
    new Message(appended.id, conversation, appended.author_type, appended.author_id, message.fingerprint, appended.created_at);
    await this.database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
      occurred_at,available_at) select $1,'support.message.sent',1,'conversation',$2,$3,
      jsonb_build_object('ticket',$4,'conversation',$2,'message',$5,'authorType',$6,'member',target.member_id),$1,
      clock_timestamp(),clock_timestamp() from support.conversation target where target.id=$2 and target.member_id is not null`,
    [`event:${randomUUID()}`, conversation, scope, ticket, message.id, author]);
    return result;
  }

  async history(ticket: string, scope: string, kind: string, actor: string, evidence: Readonly<Record<string, unknown>>): Promise<void> {
    await this.database.query(`insert into support.history(ticket_id,sequence,kind,actor_id,evidence,occurred_at,scope_id)
      select $1,coalesce(max(sequence),0)+1,$3,$4,$5::jsonb,clock_timestamp(),$2 from support.history where ticket_id=$1`,
    [ticket, scope, kind, actor, JSON.stringify(evidence)]);
  }

  async enqueue(kind: 'supportsla' | 'supportscan', scope: string, payload: Readonly<Record<string, unknown>>, availableAt?: string,
    stableId?: string): Promise<void> {
    await this.database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,$2,'support',$3,$4::jsonb,'queued',10,coalesce($5::timestamptz,clock_timestamp()),clock_timestamp(),clock_timestamp())`,
    [stableId ?? `job:${randomUUID()}`, kind, scope, JSON.stringify(payload), availableAt ?? null]);
  }
}
