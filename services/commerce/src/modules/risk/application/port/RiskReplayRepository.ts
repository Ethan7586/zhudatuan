import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { RiskOutcome } from '../../domain/model/RiskPolicy';

export interface RiskReplaySample {
  readonly actor: string;
  readonly operation: string;
  readonly resource: string | null;
  readonly outcome: RiskOutcome;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly falsePositive: boolean;
}

export interface RiskReplayRepository {
  begin(context: WriteTransactionContext, policy: string, version: number): Promise<Readonly<{ scope: string; rule: unknown }> | null>;
  sample(context: WriteTransactionContext, scope: string): Promise<readonly RiskReplaySample[]>;
  complete(context: WriteTransactionContext, policy: string, version: number, preview: Readonly<Record<string, unknown>>): Promise<void>;
}
