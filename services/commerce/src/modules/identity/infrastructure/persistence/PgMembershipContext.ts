import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { DomainError } from '../../../../platform/error/DomainError';
import { databaseInteger } from '../../../../platform/database/DatabaseInteger';
import type { MembershipContext, MembershipContextPort } from '../../public/MembershipContextPort';

interface MembershipContextRow {
  readonly principal_id: string;
  readonly membership_id: string;
  readonly membership_status: string;
  readonly access_version: number | string;
  readonly assurance: number | string;
}

export class PgMembershipContext implements MembershipContextPort {
  private readonly transactions = new PgTransactionAccess();

  async read(context: ReadTransactionContext, principal: string, membership: string): Promise<MembershipContext> {
    const result = await this.transactions.database(context).query<MembershipContextRow>('select principal_id,membership_id,membership_status,access_version,assurance from identity.navigation_identity($1,$2)', [principal, membership]);
    const row = result.rows[0];
    if (!row || row.membership_status !== 'active') throw new DomainError('MEMBERSHIP_INACTIVE');
    return Object.freeze({
      principal: row.principal_id,
      membership: row.membership_id,
      membershipStatus: row.membership_status,
      accessVersion: databaseInteger(row.access_version),
      assurance: databaseInteger(row.assurance),
    });
  }
}
