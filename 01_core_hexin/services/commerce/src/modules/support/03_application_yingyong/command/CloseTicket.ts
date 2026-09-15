import { randomUUID } from 'node:crypto';
import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { Ticket, type TicketPriority, type TicketState } from '../../02_domain_yewu/model/Ticket';
import type { SupportPortFactory } from '../../01_public_gongkai/SupportPort';

export function closeTicketOperations(ports: SupportPortFactory): OperationActions {
  return {
    'support.cases.update': (request, database) => update(request, database, ports),
    'support.cases.close': (request, database) => transition(request, database, 'closed', ports),
    'support.cases.reopen': (request, database) => transition(request, database, 'open', ports),
  };
}

async function update(request: OperationRequest, database: OperationDatabase, ports: SupportPortFactory) {
  const access = requireAccess(request); const body = bodyRecord(request); const id = request.input.path.caseid!;
  const current = await load(database, id, access.scope.id); const escalation = escalationTarget(body.escalation);
  if (escalation !== null && body.state !== undefined) throw new Error('SUPPORT_ESCALATION_STATE_AMBIGUOUS');
  const state = escalation === null ? (body.state === undefined ? current.state : ticketState(body.state)) : 'waiting';
  if (request.input.expectedVersion === undefined) throw new Error('EXPECTED_VERSION_REQUIRED');
  if (request.input.expectedVersion !== current.version) throw new Error('VERSION_CONFLICT');
  if (state !== current.state) current.aggregate.requireTransition(state);
  const priority = body.priority === undefined ? current.priority : ticketPriority(body.priority);
  const priorityReviewed = body.priority !== undefined;
  const sla = priorityReviewed ? await ports(database).sla(current.scope, priority) : null;
  const result = await database.query(`update support.ticket ticket set priority=$3,state=$4,updated_at=clock_timestamp(),version=version+1,
    response_due_at=case when $6::boolean then case when $7::integer is null then null else clock_timestamp()+make_interval(secs=>$7) end
      else response_due_at end,
    resolution_due_at=case when $6::boolean then case when $8::integer is null then null else clock_timestamp()+make_interval(secs=>$8) end
      else resolution_due_at end
    where ticket.id=$1 and ticket.scope_id=$2 and ticket.version=$5 returning ticket.*`,
  [id, current.scope, priority, state, request.input.expectedVersion, priorityReviewed, sla?.response ?? null, sla?.resolution ?? null]);
  if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
  if (body.subject !== undefined) await database.query(`update support.conversation set subject=$2,updated_at=clock_timestamp(),version=version+1
    where id=$1`, [current.conversation, textField(body, 'subject')]);
  const updated = result.rows[0] as Readonly<Record<string, unknown>>;
  if (escalation !== null) {
    const created = await database.query(`insert into support.escalation(id,ticket_id,reason,target,state,created_at,scope_id)
      values($1,$2,'manual-platform',$3,'open',clock_timestamp(),$4)
      on conflict(ticket_id,reason) do nothing returning id`, [`escalation:${randomUUID()}`, id, escalation, current.scope]);
    if (!created.rows[0]) throw new Error('SUPPORT_ESCALATION_ALREADY_OPEN');
  }
  if (priorityReviewed) await Promise.all([
    ...(updated.response_due_at === null ? [] : [ports(database).enqueue('supportsla', current.scope,
      { ticket: id, phase: 'response' }, String(updated.response_due_at), `job:sla:response:${id}:v${current.version + 1}`)]),
    ...(updated.resolution_due_at === null ? [] : [ports(database).enqueue('supportsla', current.scope,
      { ticket: id, phase: 'resolution' }, String(updated.resolution_due_at), `job:sla:resolution:${id}:v${current.version + 1}`)]),
  ]);
  await ports(database).history(id, current.scope, priorityReviewed ? 'priority.reviewed' : escalation === null ? 'updated' : 'platform.escalated',
    access.actor.id, { priority, previousPriority: current.priority, state, subject: body.subject ?? null,
      ...(escalation === null ? {} : { target: escalation }) });
  return rowResult(result);
}

async function transition(request: OperationRequest, database: OperationDatabase, target: TicketState, ports: SupportPortFactory) {
  const access = requireAccess(request); const id = request.input.path.caseid!; const current = await load(database, id, access.scope.id);
  if (request.input.expectedVersion === undefined) throw new Error('EXPECTED_VERSION_REQUIRED');
  if (request.input.expectedVersion !== current.version) throw new Error('VERSION_CONFLICT');
  current.aggregate.requireTransition(target);
  const result = await database.query(`update support.ticket set state=$3,updated_at=clock_timestamp(),version=version+1
    where id=$1 and scope_id=$2 and version=$4 returning *`, [id, current.scope, target, request.input.expectedVersion]);
  if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
  await ports(database).history(id, current.scope, target, access.actor.id, {}); return rowResult(result);
}

async function load(database: OperationDatabase, id: string, scope: string) {
  const result = await database.query<{ id: string; conversation_id: string; scope_id: string; priority: TicketPriority;
    state: TicketState; version: number }>(`select ticket.* from support.ticket ticket where ticket.id=$1 and exists(select 1
    from organization.unitclosure where ancestor_id=$2 and descendant_id=ticket.scope_id) for update`, [id, scope]);
  const row = result.rows[0]; if (!row) throw new Error('RESOURCE_NOT_FOUND');
  return { conversation: row.conversation_id, scope: row.scope_id, priority: row.priority, state: row.state, version: row.version,
    aggregate: new Ticket(row.id, row.conversation_id, row.scope_id, row.priority, row.state, row.version) };
}
function ticketState(value: unknown): TicketState {
  if (!['open','assigned','waiting','resolved','closed'].includes(String(value))) throw new Error('SUPPORT_STATE_INVALID'); return value as TicketState;
}
function ticketPriority(value: unknown): TicketPriority {
  if (!['low','normal','high','urgent'].includes(String(value))) throw new Error('SUPPORT_PRIORITY_INVALID'); return value as TicketPriority;
}
function escalationTarget(value: unknown): 'platform' | null {
  if (value === undefined) return null;
  if (value !== 'platform') throw new Error('SUPPORT_ESCALATION_TARGET_INVALID');
  return value;
}
