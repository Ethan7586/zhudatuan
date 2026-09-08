import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface PasswordCredential {
  readonly id: string;
  readonly principal: string;
  readonly secretHash: string | null;
  readonly version: number;
}

export interface CredentialVersion {
  readonly credentialVersion: number;
  readonly version: number;
}

export interface CredentialSecurity {
  readonly hasLocalCredential: boolean;
  readonly passwordChangedAt: Date | null;
}

export interface CredentialRepository {
  matchPassword(context: ReadTransactionContext, subjectHashes: readonly string[]): Promise<PasswordCredential | null>;
  confirmPassword(context: WriteTransactionContext, credential: Pick<PasswordCredential, 'id' | 'principal' | 'version'>): Promise<boolean>;
  password(context: WriteTransactionContext, principal: string): Promise<PasswordCredential | null>;
  principalForSubject(context: ReadTransactionContext, subjectHash: string): Promise<string | null>;
  changePassword(context: WriteTransactionContext, principal: string, credential: string, secretHash: string, currentSession: string): Promise<CredentialVersion>;
  resetPassword(context: WriteTransactionContext, principal: string, secretHash: string): Promise<CredentialVersion>;
  changeSubject(context: WriteTransactionContext, principal: string, subjectHash: string, currentSession: string): Promise<void>;
  security(context: ReadTransactionContext, principal: string): Promise<CredentialSecurity>;
}
