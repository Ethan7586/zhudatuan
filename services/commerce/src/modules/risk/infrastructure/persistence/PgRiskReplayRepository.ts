import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { RiskReplayRepository } from '../../application/port/RiskReplayRepository';
import { PgRiskPolicyStore } from './PgRiskPolicyStore';

export class PgRiskReplayRepository implements RiskReplayRepository {
  private readonly transactions = new PgTransactionAccess();

  begin(context: WriteTransactionContext, policy: string, version: number) {
    return this.repository(context).replay(policy, version);
  }

  sample(context: WriteTransactionContext, scope: string) {
    return this.repository(context).sample(scope);
  }

  complete(context: WriteTransactionContext, policy: string, version: number, preview: Readonly<Record<string, unknown>>): Promise<void> {
    return this.repository(context).complete(policy, version, preview);
  }

  private repository(context: WriteTransactionContext): PgRiskPolicyStore {
    return new PgRiskPolicyStore(this.transactions.database(context));
  }
}
