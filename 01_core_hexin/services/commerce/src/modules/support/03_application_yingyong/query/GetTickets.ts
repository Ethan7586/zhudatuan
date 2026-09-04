import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../../../foundation/interface/Validation';
import type { SupportPortFactory } from '../../01_public_gongkai/SupportPort';

export function getTicketsOperations(ports: SupportPortFactory): OperationActions {
  return {
    'support.history.read': async (request, database) => {
      const access = requireAccess(request); const member = await ports(database).member(access.membership.id); const page = queryPage(request, 500);
      const result = await database.query(`select history.sequence,history.sequence::text cursor_id,history.kind,history.actor_id,
        history.evidence,history.occurred_at from support.history history join support.ticket ticket on ticket.id=history.ticket_id
        join support.conversation conversation on conversation.id=ticket.conversation_id where ticket.id=$1 and
        (conversation.member_id=$3 or exists(select 1 from organization.unitclosure where ancestor_id=$2 and descendant_id=ticket.scope_id))
        and ($4::bigint is null or history.sequence>$4::bigint) order by history.sequence limit $5`,
      [request.input.path.caseid!, access.scope.id, member, page.sort, page.fetch]);
      return keysetResult(result, page, 'sequence', 'cursor_id');
    },
    'support.agents.read': list('support.agent', 'id', ['id','membership_id','skills','capacity','state']),
    'support.accounts.read': list('support.account', 'id', ['id','channel','external_ref','state','version']),
    'support.rules.read': list('support.assignmentrule', 'id', ['id','name','skill','priorities','weight','state','version','updated_at']),
    'support.slas.read': list('support.sla', 'id', ['id','priority','response_seconds','resolution_seconds','version']),
  };
}

function list(table: string, cursor: string, columns: readonly string[]): NonNullable<OperationActions[keyof OperationActions]> {
  return async (request, database) => {
    const access = requireAccess(request); const page = queryPage(request);
    const result = await database.query(`select ${columns.join(',')} from ${table} where scope_id=$1 and ($2::text is null or ${cursor}>$2)
      order by ${cursor} limit $3`, [access.scope.id, page.id, page.fetch]);
    return keysetResult(result, page, cursor);
  };
}
