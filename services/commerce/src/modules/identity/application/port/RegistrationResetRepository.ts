import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface RegistrationResetTarget {
  readonly principal: string;
  readonly version: number;
  readonly passwordVerified: boolean;
}

export interface RegistrationResetReceipt {
  readonly principal: string;
  readonly credentialVersion: number;
  readonly version: number;
}

export interface RegistrationResetRepository {
  lock(context: WriteTransactionContext, resource: string): Promise<void>;
  target(context: WriteTransactionContext, principal: string, actor: string): Promise<RegistrationResetTarget>;
  reset(context: WriteTransactionContext, target: RegistrationResetTarget, salt: string): Promise<RegistrationResetReceipt | null>;
}
