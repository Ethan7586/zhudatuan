import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { RiskReplayRepository } from '../../application/port/RiskReplayRepository';
import { PgRiskRepository } from './PgRiskRepository';

export class PgRiskReplayRepository implements RiskReplayRepository {
  private readonly transactions = new PgTransactionAccess();

  begin(context: WriteTransactionContext, policy: string, version: number) {
    return this.repository(context).replay(policy, version);
  }

  sample(context: WriteTransactionContext, scope: string) {
    return this.repository(context).replaySample(scope);
  }

  complete(context: WriteTransactionContext, policy: string, version: number, preview: Readonly<Record<string, unknown>>): Promise<void> {
    return this.repository(context).completeReplay(policy, version, preview);
  }

  catalogDecision(context: WriteTransactionContext, decision: string) {
    return this.repository(context).catalogDecision(decision);
  }

  private repository(context: WriteTransactionContext): PgRiskRepository {
    return new PgRiskRepository(this.transactions.database(context));
  }
}
