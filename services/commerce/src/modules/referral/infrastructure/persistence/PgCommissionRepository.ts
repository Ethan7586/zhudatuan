import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CommissionRepository } from '../../application/port/CommissionRepository';
export class PgCommissionRepository implements CommissionRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async read(context: ReadTransactionContext, scope: string, beneficiary: string | null, page: Parameters<CommissionRepository['read']>[3]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select id,order_id "orderId",beneficiary_id "promoterId",state status,amount_minor "amountMinor",currency,
      eligible_at "availableAt",version from referral.commission
      where scope_id=$1 and ($2::text is null or beneficiary_id=$2) and ($3::text is null or id>$3) order by id limit $4`,
      [scope, beneficiary, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
  async earnings(context: ReadTransactionContext, scope: string, beneficiary: string) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select coalesce(sum(amount_minor-reversed_minor) filter(where state='available'),0) "availableMinor",
      coalesce(sum(amount_minor-reversed_minor) filter(where state='pending'),0) "pendingMinor",
      coalesce(sum(amount_minor-reversed_minor) filter(where state='settled'),0) "settledMinor",
      coalesce(sum(reversed_minor),0) "reversedMinor",coalesce(min(currency),'CNY') currency,
      coalesce(max(version),1) version,coalesce(jsonb_agg(jsonb_build_object('id',id,'orderId',order_id,'promoterId',beneficiary_id,
      'status',state,'amountMinor',amount_minor,'currency',currency,'availableAt',eligible_at,'version',version) order by id),'[]') items
      from referral.commission where scope_id=$1 and beneficiary_id=$2`,
      [scope, beneficiary]
    );
    if (!result.rows[0]) throw new Error('REFERRAL_EARNINGS_READ_FAILED');
    return Object.freeze({ ...result.rows[0] });
  }
}
