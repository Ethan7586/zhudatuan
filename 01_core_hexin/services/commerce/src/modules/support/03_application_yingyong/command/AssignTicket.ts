import { randomUUID } from 'node:crypto';
import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import { AssignmentRule } from '../../02_domain_yewu/model/AssignmentRule';
import { Sla } from '../../02_domain_yewu/model/Sla';
import type { TicketPriority } from '../../02_domain_yewu/model/Ticket';
import { AssignmentPolicy } from '../../02_domain_yewu/policy/AssignmentPolicy';
import type { SupportPortFactory } from '../../01_public_gongkai/SupportPort';

export function assignTicketOperations(ports: SupportPortFactory): OperationActions {
  const assignment = new AssignmentPolicy();
  return {
    'support.assignments.manage': async (request, database) => {
      const access = requireAccess(request); const body = bodyRecord(request); const ticket = textField(body, 'case'); const agent = textField(body, 'agent');
      const locked = await database.query<{ scope_id: string; conversation_id: string; member_id: string | null }>(`select ticket.scope_id,
        ticket.conversation_id,conversation.member_id from support.ticket ticket join support.conversation conversation
        on conversation.id=ticket.conversation_id join support.agent agent
        on agent.id=$3 and agent.scope_id=ticket.scope_id where ticket.id=$1 and ticket.state<>'closed' and exists(select 1
        from organization.unitclosure where ancestor_id=$2 and descendant_id=ticket.scope_id) for update of ticket`, [ticket, access.scope.id, agent]);
      const target = locked.rows[0]; if (!target) throw new Error('SUPPORT_ASSIGNMENT_INVALID');
      await database.query('update support.assignment set released_at=clock_timestamp() where ticket_id=$1 and released_at is null', [ticket]);
      const result = await database.query(`insert into support.assignment(id,ticket_id,agent_id,reason,assigned_at,scope_id)
        values($1,$2,$3,$4,clock_timestamp(),$5) returning *`, [request.input.path.assignmentid!, ticket, agent,
        textField(body, 'reason'), target.scope_id]);
      await database.query("update support.ticket set assigned_agent_id=$2,state='assigned',updated_at=clock_timestamp(),version=version+1 where id=$1", [ticket, agent]);
      if (target.member_id) await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,
        payload,trace_id,occurred_at,available_at) values($1::text,'support.ticket.assigned',1,'ticket',$2::text,$3::text,
        jsonb_build_object('ticket',$2::text,'conversation',$4::text,'agent',$5::text,'member',$6::text),
        $7::text,clock_timestamp(),clock_timestamp())`,
      [`event:${crypto.randomUUID()}`, ticket, target.scope_id, target.conversation_id, agent, target.member_id, access.trace]);
      await ports(database).history(ticket, target.scope_id, 'assigned', access.actor.id, { agent, reason: body.reason }); return rowResult(result);
    },
    'support.agents.manage': async (request, database) => {
      const access = requireAccess(request); const body = bodyRecord(request);
      const capacity = integerField(body, 'capacity', 1); if (capacity > 100) throw new Error('SUPPORT_AGENT_CAPACITY_EXCEEDED');
      const agentState = choice(body.state, ['offline','available','busy','disabled'], 'SUPPORT_AGENT_STATE_INVALID');
      const result = await database.query(`insert into support.agent(id,scope_id,membership_id,skills,capacity,state) values($1,$2,$3,$4::jsonb,$5,$6)
        on conflict(id) do update set skills=excluded.skills,capacity=excluded.capacity,state=excluded.state
        where support.agent.scope_id=$2 returning *`, [request.input.path.agentid!, access.scope.id, textField(body, 'membership'),
        JSON.stringify(strings(body.skills)), capacity, agentState]);
      if (agentState !== 'available') {
        const stranded = await database.query<{ id: string; scope_id: string; priority: TicketPriority; skill: string }>(`select id,scope_id,
          priority,skill from support.ticket where assigned_agent_id=$1 and scope_id=$2 and state in('assigned','waiting')
          order by id for update limit 101`, [request.input.path.agentid!, access.scope.id]);
        if (stranded.rows.length > 100) throw new Error('SUPPORT_REASSIGNMENT_BATCH_EXCEEDED');
        const repository = ports(database); const agents = await repository.agents(access.scope.id); const rules = await repository.rules(access.scope.id);
        for (const ticket of stranded.rows) {
          const selected = assignment.decide({ agents, rules, scope: ticket.scope_id, skill: ticket.skill, priority: ticket.priority });
          await database.query('update support.assignment set released_at=clock_timestamp() where ticket_id=$1 and released_at is null', [ticket.id]);
          if (selected) await database.query(`insert into support.assignment(id,ticket_id,agent_id,reason,assigned_at,scope_id)
            values($1,$2,$3,'agent-unavailable',clock_timestamp(),$4)`, [`assignment:${randomUUID()}`, ticket.id, selected.id, ticket.scope_id]);
          await database.query(`update support.ticket set assigned_agent_id=$2,state=$3,updated_at=clock_timestamp(),version=version+1
            where id=$1`, [ticket.id, selected?.id ?? null, selected ? 'assigned' : 'open']);
          await repository.history(ticket.id, ticket.scope_id, selected ? 'reassigned' : 'unassigned', access.actor.id,
            { unavailableAgent: request.input.path.agentid!, assigned: selected?.id ?? null });
        }
      }
      return rowResult(result);
    },
    'support.accounts.manage': async (request, database) => {
      const access = requireAccess(request); const body = bodyRecord(request);
      const result = await database.query(`insert into support.account(id,scope_id,channel,external_ref,secret_ref,state,version)
        values($1,$2,$3,$4,$5,$6,0) on conflict(id) do update set external_ref=excluded.external_ref,secret_ref=excluded.secret_ref,
        state=excluded.state,version=support.account.version+1 where support.account.scope_id=$2
        and ($7::bigint is null or support.account.version=$7) returning *`, [request.input.path.accountid!, access.scope.id,
        choice(body.channel, ['inapp','wechat','email','sms'], 'SUPPORT_CHANNEL_INVALID'), textField(body, 'externalRef'), body.secretRef ?? null,
        choice(body.state ?? 'active', ['active','disabled'], 'SUPPORT_ACCOUNT_STATE_INVALID'), request.input.expectedVersion ?? null]);
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT'); return rowResult(result);
    },
    'support.rules.manage': async (request, database) => {
      const access = requireAccess(request); const body = bodyRecord(request); const priorities = strings(body.priorities) as TicketPriority[];
      const state = choice(body.state, ['active','disabled'], 'SUPPORT_RULE_STATE_INVALID'); const weight = integerField(body, 'weight', 1);
      new AssignmentRule(request.input.path.ruleid!, access.scope.id, textField(body, 'skill'), priorities, weight, state === 'active');
      const result = await database.query(`insert into support.assignmentrule(id,scope_id,name,skill,priorities,weight,state,version,created_at,updated_at)
        values($1,$2,$3,$4,$5,$6,$7,0,clock_timestamp(),clock_timestamp()) on conflict(id) do update set name=excluded.name,
        skill=excluded.skill,priorities=excluded.priorities,weight=excluded.weight,state=excluded.state,version=support.assignmentrule.version+1,
        updated_at=clock_timestamp() where support.assignmentrule.scope_id=$2 and ($8::bigint is null or support.assignmentrule.version=$8) returning *`,
      [request.input.path.ruleid!, access.scope.id, textField(body, 'name'), textField(body, 'skill'), priorities, weight, state,
        request.input.expectedVersion ?? null]);
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT'); return rowResult(result);
    },
    'support.slas.manage': async (request, database) => {
      const access = requireAccess(request); const body = bodyRecord(request); const priority = choice(body.priority,
        ['low','normal','high','urgent'], 'SUPPORT_PRIORITY_INVALID') as TicketPriority;
      const response = integerField(body, 'responseSeconds', 1); const resolution = integerField(body, 'resolutionSeconds', response);
      const version = integerField(body, 'version', 1); new Sla(request.input.path.slaid!, access.scope.id, priority, response, resolution, version);
      const result = await database.query(`insert into support.sla(id,scope_id,priority,response_seconds,resolution_seconds,version)
        values($1,$2,$3,$4,$5,$6) on conflict(id) do update set priority=excluded.priority,response_seconds=excluded.response_seconds,
        resolution_seconds=excluded.resolution_seconds,version=excluded.version where support.sla.scope_id=$2
        and support.sla.version<$6 returning *`, [request.input.path.slaid!, access.scope.id, priority, response, resolution, version]);
      if (!result.rows[0]) throw new Error('SUPPORT_SLA_VERSION_CONFLICT'); return rowResult(result);
    },
  };
}

function choice(value: unknown, allowed: readonly string[], code: string): string {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(code); return value;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === 'string' && item.trim())) throw new Error('STRING_ARRAY_REQUIRED');
  return [...new Set(value.map((item) => String(item).trim()))];
}
