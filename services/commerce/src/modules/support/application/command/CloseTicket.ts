import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { Ticket, type TicketPriority, type TicketState } from '../../domain/model/Ticket';
import type { SupportPortFactory } from '../port/SupportPort';

export function closeTicketOperations(ports: SupportPortFactory): OperationActions {
  return {
    'support.cases.update': (request, database) => update(request, database, ports),
    'support.cases.close': (request, database) => transition(request, database, 'closed', ports),
    'support.cases.reopen': (request, database) => transition(request, database, 'open', ports),
  };
}

async function update(request: OperationRequest, database: OperationDatabase, ports: SupportPortFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const id = request.input.path.caseid!;
  const repository = ports(database);
  const current = await load(database, id, await repository.descendants(access.scope.id));
  const state = body.state === undefined ? current.state : ticketState(body.state);
  if (state !== current.state) current.aggregate.requireTransition(state);
  const priority = body.priority === undefined ? current.priority : ticketPriority(body.priority);
  const result = await database.query(
    `update support.ticket ticket set priority=$3,state=$4,updated_at=clock_timestamp(),version=version+1
    where ticket.id=$1 and ticket.scope_id=$2 and ticket.version=$5 returning ticket.*`,
    [id, current.scope, priority, state, current.version]
  );
  if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
  if (body.subject !== undefined)
    await database.query(
      `update support.conversation set subject=$2,updated_at=clock_timestamp(),version=version+1
    where id=$1`,
      [current.conversation, textField(body, 'subject')]
    );
  await repository.history(id, current.scope, 'updated', access.actor.id, { priority, state, subject: body.subject ?? null });
  return rowResult(result);
}

async function transition(request: OperationRequest, database: OperationDatabase, target: TicketState, ports: SupportPortFactory) {
  const access = requireAccess(request);
  const id = request.input.path.caseid!;
  const repository = ports(database);
  const current = await load(database, id, await repository.descendants(access.scope.id));
  current.aggregate.requireTransition(target);
  const result = await database.query(
    `update support.ticket set state=$3,updated_at=clock_timestamp(),version=version+1
    where id=$1 and scope_id=$2 and version=$4 returning *`,
    [id, current.scope, target, current.version]
  );
  await repository.history(id, current.scope, target, access.actor.id, {});
  return rowResult(result);
}

async function load(database: OperationDatabase, id: string, scopes: readonly string[]) {
  const result = await database.query<{ id: string; conversation_id: string; scope_id: string; priority: TicketPriority; state: TicketState; version: number }>(
    `select ticket.id,ticket.conversation_id,ticket.scope_id,ticket.priority,ticket.state,ticket.version
    from support.ticket ticket where ticket.id=$1 and ticket.scope_id=any($2::text[]) for update`,
    [id, scopes]
  );
  const row = result.rows[0];
  if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
  return { conversation: row.conversation_id, scope: row.scope_id, priority: row.priority, state: row.state, version: row.version, aggregate: new Ticket(row.id, row.conversation_id, row.scope_id, row.priority, row.state, row.version) };
}
function ticketState(value: unknown): TicketState {
  if (!['open', 'assigned', 'waiting', 'resolved', 'closed'].includes(String(value))) throw new Error('SUPPORT_STATE_INVALID');
  return value as TicketState;
}
function ticketPriority(value: unknown): TicketPriority {
  if (!['low', 'normal', 'high', 'urgent'].includes(String(value))) throw new Error('SUPPORT_PRIORITY_INVALID');
  return value as TicketPriority;
}
