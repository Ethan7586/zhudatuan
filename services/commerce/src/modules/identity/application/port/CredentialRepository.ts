import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface PasswordCredential {
  readonly id: string;
  readonly principal: string;
  readonly secretHash: string | null;
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
  matchPassword(database: OperationDatabase, subjectHashes: readonly string[]): Promise<PasswordCredential | null>;
  password(database: OperationDatabase, principal: string, lock: boolean): Promise<PasswordCredential | null>;
  principalForSubject(database: OperationDatabase, subjectHash: string): Promise<string | null>;
  changePassword(database: OperationDatabase, principal: string, credential: string, secretHash: string, currentSession: string): Promise<CredentialVersion>;
  resetPassword(database: OperationDatabase, principal: string, secretHash: string): Promise<CredentialVersion>;
  changeSubject(database: OperationDatabase, principal: string, subjectHash: string, currentSession: string): Promise<void>;
  security(database: OperationDatabase, principal: string): Promise<CredentialSecurity>;
}
