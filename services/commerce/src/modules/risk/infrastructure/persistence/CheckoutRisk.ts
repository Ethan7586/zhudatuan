import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { EvaluateRisk } from '../../application/service/EvaluateRisk';
import { signal } from '../../domain/model/Signal';
import { PgRiskRepository } from '../persistence/PgRiskRepository';
import type { CheckoutRiskInput, CheckoutRiskPort } from '../../public';
export class CheckoutRisk implements CheckoutRiskPort {
  private readonly transactions = new PgTransactionAccess();
  async assess(context: ReadTransactionContext, input: CheckoutRiskInput) {
    const database = this.transactions.database(context);
    return new EvaluateRisk(new PgRiskRepository(database)).check({
      actor: input.actor,
      operation: input.operation,
      resource: input.resource,
      scope: input.scope,
      scopes: input.scopes,
      trace: input.trace,
      amountMinor: input.amountMinor,
      signals: Object.freeze(Object.entries(input.signals).map(([type, value]) => signal(type, value, new Date().toISOString()))),
    });
  }
}
