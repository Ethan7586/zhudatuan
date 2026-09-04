import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrderImportFinancePort } from '../../public';

export class PgStatementEvidencePort implements OrderImportFinancePort {
  private readonly transactions = new PgTransactionAccess();

  async verifyStatementEvidence(context: ReadTransactionContext, reference: string, scope: string, amountMinor: number, currency: string): Promise<boolean> {
    const result = await this.transactions.database(context).query(
      `select 1 from finance.statementline line join finance.reconciliation reconciliation on reconciliation.id=line.reconciliation_id
      where line.external_reference=$1 and line.scope_id=$2 and line.amount_minor=$3 and line.currency=$4
      and line.kind='payment' and reconciliation.state='balanced' limit 1`,
      [reference, scope, amountMinor, currency]
    );
    return Boolean(result.rows[0]);
  }
}
