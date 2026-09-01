import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AccessPartnerPort, AccessPartnerScope } from '../../public';
export class PartnerPort implements AccessPartnerPort {
  private readonly transactions = new PgTransactionAccess();
  async invitationScope(context: ReadTransactionContext, partner: string): Promise<AccessPartnerScope | null> {
    const database = this.transactions.database(context);
    const result = await database.query<AccessPartnerScope>(
      `select subject.id,subject.kind,subject.scope_id organization
      from partner.partner subject where subject.id=$1 and subject.kind in('supplier','brand','store') and subject.status='active'
      and (subject.kind='store' and exists(select 1 from partner.servicebinding binding where binding.store_id=subject.id
          and binding.status='active' and binding.effective_at<=clock_timestamp()
          and (binding.expires_at is null or binding.expires_at>clock_timestamp()))
        or subject.kind in('supplier','brand') and exists(select 1 from partner.relationship relation
          where (relation.left_partner_id=subject.id or relation.right_partner_id=subject.id) and relation.status='active'
            and relation.effective_at<=clock_timestamp()
            and (relation.expires_at is null or relation.expires_at>clock_timestamp())))`,
      [partner]
    );
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }
}
