import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { BenefitMemberPort } from '../../public/BenefitMemberPort';
export class PgBenefitMemberPort implements BenefitMemberPort {
  private readonly transactions = new PgTransactionAccess();
  async active(context: ReadTransactionContext, member: string): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      active: boolean;
    }>(`select exists(select 1 from member.profile where id=$1 and status='active') active`, [member]);
    return result.rows[0]?.active === true;
  }
}
