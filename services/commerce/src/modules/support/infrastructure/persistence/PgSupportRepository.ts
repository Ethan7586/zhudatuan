import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { randomUUID } from 'node:crypto';

import { AssignmentRule } from '../../domain/model/AssignmentRule';
import type { TicketPriority } from '../../domain/model/Ticket';
import type { Agent } from '../../domain/policy/AssignmentPolicy';
import { Message } from '../../domain/model/Message';
import type { EncryptedMessage, SlaPolicy, SupportPersistencePort } from './SupportPersistencePort';
import type { GetOrderSummary } from '../../../order/public/index';
import type { OrganizationReadPort } from '../../../organization/public';
import type { MemberAccessPort } from '../../../access/public';
import type { SupportBenefitPort } from '../../../benefit/public';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';

export class PgSupportRepository implements SupportPersistencePort {
  constructor(
    private readonly database: SqlExecutor,
    private readonly orders: Pick<GetOrderSummary, 'execute'>,
    private readonly organizations: OrganizationReadPort,
    private readonly members: MemberAccessPort,
    private readonly benefits: SupportBenefitPort
  ) {}

  async member(membership: string): Promise<string> {
    return this.members.member(this.database.transaction, membership);
  }

  descendants(scope: string): Promise<readonly string[]> {
    return this.organizations.descendants(this.database.transaction, scope);
  }

  async assertOrder(order: string, scope: string, member: string, memberOnly: boolean): Promise<void> {
    const scopes = memberOnly ? [] : await this.organizations.descendants(this.database.transaction, scope);
    if (!(await this.orders.execute(this.database.transaction, order, scopes, member, memberOnly))) throw new Error('SUPPORT_ORDER_SCOPE_INVALID');
  }

  async benefit(type: string, id: string, scope: string, member: string): Promise<Readonly<Record<string, unknown>>> {
    if (type !== 'benefitlot') throw new Error('SUPPORT_REFERENCE_TYPE_INVALID');
    const result = await this.benefits.lot(this.database.transaction, id, member, await this.descendants(scope));
    if (!result) throw new Error('SUPPORT_BENEFIT_REFERENCE_INVALID');
    return result;
  }

  async agents(scope: string): Promise<readonly Agent[]> {
    const result = await this.database.query<{ id: string; skills: string[]; capacity: number; load: number }>(
      `select agent.id,
      agent.skills,agent.capacity,count(ticket.id) filter(where ticket.state in('assigned','waiting'))::integer load
      from support.agent agent left join support.ticket ticket on ticket.assigned_agent_id=agent.id where agent.scope_id=$1
      and agent.state='available' group by agent.id having count(ticket.id) filter(where ticket.state in('assigned','waiting'))<agent.capacity`,
      [scope]
    );
    return result.rows.map((row) => ({ id: row.id, online: true, load: row.load, skills: row.skills, scopes: [scope] }));
  }

  async rules(scope: string): Promise<readonly AssignmentRule[]> {
    const result = await this.database.query<{ id: string; scope_id: string; skill: string; priorities: TicketPriority[]; weight: number; state: string }>(
      `select id,scope_id,skill,priorities,weight,state from support.assignmentrule
      where scope_id=$1 and state='active' order by weight desc,id`,
      [scope]
    );
    return result.rows.map((row) => new AssignmentRule(row.id, row.scope_id, row.skill, row.priorities, row.weight, true));
  }

  async sla(scope: string, priority: TicketPriority): Promise<SlaPolicy> {
    const result = await this.database.query<{ response_seconds: number; resolution_seconds: number }>(
      'select response_seconds,resolution_seconds from support.resolve_sla($1,$2)',
      [scope, priority]
    );
    const policy = result.rows[0];
    if (!policy) throw new Error('SUPPORT_SLA_NOT_CONFIGURED');
    return { response: policy.response_seconds, resolution: policy.resolution_seconds };
  }

  async message(ticket: string, conversation: string, scope: string, author: 'member' | 'agent', actor: string, message: EncryptedMessage) {
    const result = await this.database.query<{ id: string; author_type: 'member' | 'agent'; author_id: string; created_at: string }>(
      `insert into support.message(id,scope_id,conversation_id,author_type,author_id,body_ciphertext,
      body_hash,body_key_version,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp()) returning id,author_type,author_id,created_at`,
      [message.id, scope, conversation, author, actor, message.ciphertext, message.fingerprint, message.keyVersion]
    );
    const appended = result.rows[0];
    if (!appended) throw new Error('SUPPORT_MESSAGE_APPEND_FAILED');
    new Message(appended.id, conversation, appended.author_type, appended.author_id, message.fingerprint, appended.created_at);
    const target = await this.database.query<{ member_id: string | null }>('select member_id from support.conversation where id=$1', [conversation]);
    const member = target.rows[0]?.member_id;
    if (member) {
      const event = `event:${randomUUID()}`;
      await new PgRuntimeWriter(this.database).append({
        id: event,
        type: 'support.message.sent',
        aggregateType: 'conversation',
        aggregate: conversation,
        scope,
        payload: { ticket, conversation, message: message.id, authorType: author, member },
        trace: event,
      });
    }
    return result;
  }

  async history(ticket: string, scope: string, kind: string, actor: string, evidence: Readonly<Record<string, unknown>>): Promise<void> {
    await this.database.query(
      `insert into support.history(ticket_id,sequence,kind,actor_id,evidence,occurred_at,scope_id)
      select $1,coalesce(max(sequence),0)+1,$3,$4,$5::jsonb,clock_timestamp(),$2 from support.history where ticket_id=$1`,
      [ticket, scope, kind, actor, JSON.stringify(evidence)]
    );
  }

  async enqueue(kind: 'supportsla' | 'supportscan', scope: string, payload: Readonly<Record<string, unknown>>, availableAt?: Date | string, stableId?: string): Promise<void> {
    await new PgRuntimeWriter(this.database).schedule({
      id: stableId ?? `job:${randomUUID()}`,
      kind,
      owner: 'support',
      scope,
      payload,
      priority: 10,
      ...(availableAt === undefined ? {} : { availableAt: availableAt instanceof Date ? availableAt.toISOString() : availableAt }),
    });
  }
}
