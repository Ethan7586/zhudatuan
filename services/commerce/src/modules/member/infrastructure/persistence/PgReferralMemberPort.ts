import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { ReferralMemberPort } from '../../public/ReferralMemberPort';
export class PgReferralMemberPort implements ReferralMemberPort {
  private readonly transactions = new PgTransactionAccess();
  constructor(private readonly access: Pick<MemberAccessPort, 'profile'>) {}
  async eligible(
    context: ReadTransactionContext,
    scopeId: string,
    membershipId: string
  ): Promise<Readonly<{
    memberId: string;
    scopeId: string;
    version: number;
  }> | null> {
    const database = this.transactions.database(context);
    const membership = await this.access.profile(context, membershipId);
    const allowedScope = scopeId === membership.organization || scopeId === membership.member;
    if (membership.status !== 'active' || !allowedScope) return null;
    const result = await database.query<{
      id: string;
      version: number;
    }>(`select id,version from member.profile where id=$1 and status='active'`, [membership.member]);
    const row = result.rows[0];
    return row ? Object.freeze({ memberId: row.id, scopeId: membership.organization, version: row.version }) : null;
  }
}
