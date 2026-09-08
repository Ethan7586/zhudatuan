import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

export interface RegistrationPolicyRecord {
  readonly id: string;
  readonly terms_title: string;
  readonly terms_body: string;
  readonly privacy_title: string;
  readonly privacy_body: string;
  readonly terms_hash: string;
}

export interface RegistrationPolicyRepository {
  current(context: ReadTransactionContext): Promise<RegistrationPolicyRecord | null>;
  read(context: ReadTransactionContext, id: string, active: boolean): Promise<RegistrationPolicyRecord | null>;
}
