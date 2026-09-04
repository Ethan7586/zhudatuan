export interface ActivationAttempt {
  readonly id: string;
  readonly scope: string;
  readonly actor: string;
  readonly fingerprint: string;
  readonly attemptedAt: Date;
}

export interface ActivationRate {
  consume(context: WriteTransactionContext, attempt: ActivationAttempt): Promise<boolean>;
}

export interface ActivationLookup {
  readonly secretFingerprint: string;
  readonly numberFingerprint: string | null;
}
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
