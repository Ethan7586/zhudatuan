import type { SupportAction, SupportPersistence } from './SupportAction';
import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { keysetResult, queryPage } from '../../../../foundation/interface/Validation';
import type { SupportPersistenceFactory } from './SupportPersistencePort';

export function supportListPersistence(ports: SupportPersistenceFactory): Pick<SupportPersistence, 'readHistory' | 'readAgents' | 'readAccounts' | 'readRules' | 'readSlas'> {
  return {
    readHistory: async (request, database) => {
      const access = requireAccess(request);
      const member = await ports(database).member(access.membership.id);
      const scopes = await ports(database).descendants(access.scope.id);
      const page = queryPage(request.input);
      const result = await database.query(
        `select history.sequence,history.sequence::text cursor_id,history.kind,history.actor_id,
        history.evidence,history.occurred_at from support.history history join support.ticket ticket on ticket.id=history.ticket_id
        join support.conversation conversation on conversation.id=ticket.conversation_id where ticket.id=$1 and
        (conversation.member_id=$3 or ticket.scope_id=any($2::text[]))
        and ($4::bigint is null or history.sequence>$4::bigint) order by history.sequence limit $5`,
        [request.input.path.caseid!, scopes, member, page.sort, page.fetch]
      );
      return keysetResult(result, page, 'sequence', 'cursor_id');
    },
    readAgents: list('support.agent', 'id', ['id', 'membership_id', 'skills', 'capacity', 'state']),
    readAccounts: list('support.account', 'id', ['id', 'channel', 'external_ref', 'state', 'version']),
    readRules: list('support.assignmentrule', 'id', ['id', 'name', 'skill', 'priorities', 'weight', 'state', 'version', 'updated_at']),
    readSlas: list('support.sla', 'id', ['id', 'priority', 'response_seconds', 'resolution_seconds', 'version']),
  };
}

function list(table: string, cursor: string, columns: readonly string[]): SupportAction {
  return async (request, database) => {
    const access = requireAccess(request);
    const page = queryPage(request.input);
    const result = await database.query(
      `select ${columns.join(',')} from ${table} where scope_id=$1 and ($2::text is null or ${cursor}>$2)
      order by ${cursor} limit $3`,
      [access.scope.id, page.id, page.fetch]
    );
    return keysetResult(result, page, cursor);
  };
}
