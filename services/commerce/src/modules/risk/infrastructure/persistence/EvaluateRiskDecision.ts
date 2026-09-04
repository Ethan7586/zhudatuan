import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { OperationCatalog } from '@shop/contract';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
import { EvaluateRisk } from '../../application/service/EvaluateRisk';
import { signal } from '../../domain/model/Signal';
import type { RiskDecisionInput, RiskDecisionPort } from '../../public';
import { PgRiskRepository } from './PgRiskRepository';

export class EvaluateRiskDecision implements RiskDecisionPort {
  private readonly transactions = new PgTransactionAccess();

  async evaluate(context: ReadTransactionContext, input: RiskDecisionInput) {
    const transaction = requireWriteTransaction(context);
    const database = this.transactions.database(transaction);
    const operation = OperationCatalog.get(input.operation);
    return new EvaluateRisk(new PgRiskRepository(database)).check({
      actor: input.actor,
      operation: input.operation,
      resource: input.resource,
      scope: input.scope,
      scopes: input.scopes,
      trace: input.trace,
      amountMinor: input.amountMinor,
      signals: Object.freeze(Object.entries(input.signals).map(([type, value]) => signal({
        type, version: 1, value, source: `operation:${input.operation}`, sensitivity: 'personal', observedAt: new Date().toISOString(),
      }))),
      risk: operation.risk,
      mode: operation.executionMode === 'async' ? 'async' : 'sync',
      deadline: transaction.deadline,
      signal: transaction.signal,
    });
  }
}
