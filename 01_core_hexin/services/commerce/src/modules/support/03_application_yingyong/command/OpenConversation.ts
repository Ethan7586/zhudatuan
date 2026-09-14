import { randomUUID } from 'node:crypto';
import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { operationLifecycle, requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import { Conversation, type ConversationChannel } from '../../02_domain_yewu/model/Conversation';
import { Ticket, type TicketPriority } from '../../02_domain_yewu/model/Ticket';
import { AssignmentPolicy } from '../../02_domain_yewu/policy/AssignmentPolicy';
import type { EncryptedMessage, SupportPortFactory } from '../../01_public_gongkai/SupportPort';

export function openConversationOperations(kms: KmsClient, ports: SupportPortFactory): OperationActions {
  const assignment = new AssignmentPolicy();
  return { 'support.cases.create': operationLifecycle({
    prepare: async (request) => {
      const access = requireAccess(request); const body = bodyRecord(request); const ticket = `case:${randomUUID()}`;
      const conversation = `conversation:${randomUUID()}`;
      const message = body.message === undefined ? null : await encrypt(kms, textField(body, 'message', 4000));
      return { access, body, ticket, conversation, message };
    },
    execute: async (_request, database, { access, body, ticket, conversation, message }) => {
      const repository = ports(database); const priority = choice(body.priority ?? 'normal', priorities, 'SUPPORT_PRIORITY_INVALID') as TicketPriority;
      const member = await repository.member(access.membership.id); const channel = choice(body.channel ?? 'inapp', channels,
        'SUPPORT_CHANNEL_INVALID') as ConversationChannel; const subject = textField(body, 'subject');
      const order = body.order === undefined ? null : textField(body, 'order');
      if (order) await repository.assertOrder(order, access.scope.id, member, access.actor.target === 'storefront');
      const referenceType = body.resource === undefined ? null : textField(body, 'resourceType');
      const referenceId = body.resource === undefined ? null : textField(body, 'resource');
      const reference = referenceId === null ? null : await repository.benefit(referenceType!, referenceId, access.scope.id, member);
      const skill = String(body.skill ?? 'general'); const sla = await repository.sla(access.scope.id, priority);
      const selected = assignment.decide({ agents: await repository.agents(access.scope.id), rules: await repository.rules(access.scope.id),
        scope: access.scope.id, skill, priority });
      new Conversation(conversation, access.scope.id, member, channel, subject, order, 0);
      new Ticket(ticket, conversation, access.scope.id, priority, selected ? 'assigned' : 'open', 0);
      await database.query(`insert into support.conversation(id,scope_id,member_id,order_id,channel,subject,reference_type,reference_id,
        reference_evidence,created_at,updated_at,version) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,clock_timestamp(),clock_timestamp(),0)`,
      [conversation, access.scope.id, member, order, channel, subject, referenceType, referenceId,
        reference === null ? null : JSON.stringify(reference)]);
      const result = await database.query(`insert into support.ticket(id,scope_id,priority,state,assigned_agent_id,response_due_at,
        resolution_due_at,created_at,updated_at,version,conversation_id,skill) values($1,$2,$3,$4,$5,
        case when $6::integer is null then null else clock_timestamp()+make_interval(secs=>$6) end,
        case when $7::integer is null then null else clock_timestamp()+make_interval(secs=>$7) end,
        clock_timestamp(),clock_timestamp(),0,$8,$9) returning *`,
      [ticket, access.scope.id, priority, selected ? 'assigned' : 'open', selected?.id ?? null,
        sla?.response ?? null, sla?.resolution ?? null, conversation, skill]);
      if (selected) await database.query(`insert into support.assignment(id,ticket_id,agent_id,reason,assigned_at,scope_id)
        values($1,$2,$3,'policy',clock_timestamp(),$4)`, [`assignment:${randomUUID()}`, ticket, selected.id, access.scope.id]);
      if (selected) await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,
        trace_id,occurred_at,available_at) values($1::text,'support.ticket.assigned',1,'ticket',$2::text,$3::text,
        jsonb_build_object('ticket',$2::text,'conversation',$4::text,'agent',$5::text,'member',$6::text),
        $7::text,clock_timestamp(),clock_timestamp())`,
      [`event:${randomUUID()}`, ticket, access.scope.id, conversation, selected.id, member, access.trace]);
      const created = result.rows[0] as Readonly<Record<string, unknown>>;
      await Promise.all([
        ...(created.response_due_at === null ? [] : [repository.enqueue('supportsla', access.scope.id,
          { ticket, phase: 'response' }, String(created.response_due_at), `job:sla:response:${ticket}`)]),
        ...(created.resolution_due_at === null ? [] : [repository.enqueue('supportsla', access.scope.id,
          { ticket, phase: 'resolution' }, String(created.resolution_due_at), `job:sla:resolution:${ticket}`)]),
      ]);
      await repository.history(ticket, access.scope.id, 'opened', access.actor.id, { assigned: selected?.id ?? null, priority, skill });
      if (message) await repository.message(ticket, conversation, access.scope.id,
        access.actor.target === 'storefront' ? 'member' : 'agent', access.actor.id, 'public', message);
      return { ...rowResult(result, 201), body: { ...created, subject, channel, order_id: order, member_id: member } };
    },
  }) };
}

async function encrypt(kms: KmsClient, body: string): Promise<EncryptedMessage> {
  const id = `message:${randomUUID()}`; return { id, ...await kms.encrypt('support/message', body, { message: id }) };
}
const priorities = ['low', 'normal', 'high', 'urgent'] as const;
const channels = ['inapp', 'wechat', 'email', 'sms'] as const;
function choice(value: unknown, allowed: readonly string[], code: string): string {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(code); return value;
}
