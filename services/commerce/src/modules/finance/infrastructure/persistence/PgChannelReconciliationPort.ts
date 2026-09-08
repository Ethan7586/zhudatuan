import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ChannelReconciliationPort } from '../../public';

export class PgChannelReconciliationPort implements ChannelReconciliationPort {
  private readonly transactions = new PgTransactionAccess();

  async receiveReconciliation(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; provider: string; partner: string; period: string; statement: string; hash: string; run: string }>): Promise<void> {
    await this.transactions.database(context).query(
      `insert into finance.reconciliation(id,scope_id,provider,partner_id,period,statement_ref,statement_hash,state,created_by,evidence)
      values($1,$2,$3,$4,$5,$6,$7,'received','system',jsonb_build_object('syncrun',$8))
      on conflict(provider,period,statement_hash) do nothing`,
      [input.id, input.scope, input.provider, input.partner, input.period, input.statement, input.hash, input.run]
    );
  }
}
