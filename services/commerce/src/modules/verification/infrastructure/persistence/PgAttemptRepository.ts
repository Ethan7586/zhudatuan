import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrganizationReadPort } from '../../../organization/public';
import type { AttemptRepository } from '../../application/port/AttemptRepository';

export class PgAttemptRepository implements AttemptRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly organizations: OrganizationReadPort
  ) {}

  async history(context: ReadTransactionContext, scope: string, page: Parameters<AttemptRepository['history']>[2]) {
    const visibleScopes = [scope, ...(await this.organizations.scope(context, scope)).ancestors];
    const result = await this.transactions.database(context).query(
      `select attempt.id,attempt.session_id,attempt.sequence,attempt.scope_id,attempt.purpose,attempt.operation_id,
      session.subject_type,session.subject_id,attempt.actor_id,attempt.device_id,attempt.result,attempt.reason,attempt.attempted_at
      from verification.attempt attempt join verification.session session on session.id=attempt.session_id
      where attempt.scope_id=any($1::text[])
      and ($2::timestamptz is null or (attempt.attempted_at,attempt.id)<($2::timestamptz,$3))
      order by attempt.attempted_at desc,attempt.id desc limit $4`,
      [visibleScopes, page.sort, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
}
