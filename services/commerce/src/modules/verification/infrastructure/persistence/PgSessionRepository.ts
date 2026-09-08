import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { SessionRepository } from '../../application/port/SessionRepository';

export class PgSessionRepository implements SessionRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly members: MemberAccessPort
  ) {}

  async read(context: ReadTransactionContext, _scope: string, membership: string, page: Parameters<SessionRepository['read']>[3]) {
    const member = await this.members.member(context, membership);
    const result = await this.transactions.database(context).query(
      `select session.id,session.subject_type,session.subject_id,session.purpose,session.operation_id,session.channel,
      session.state,session.attempts,session.maximum_attempts,session.expires_at,session.verified_at,session.version
      from verification.session session where session.subject_id=$1
      and ($2::timestamptz is null or (session.expires_at,session.id)<($2::timestamptz,$3))
      order by session.expires_at desc,session.id desc limit $4`,
      [member, page.sort, page.id, page.fetch]
    );
    return rows(result.rows);
  }
}

function rows(value: readonly Readonly<Record<string, unknown>>[]) {
  return Object.freeze(value.map((row) => Object.freeze({ ...row })));
}
