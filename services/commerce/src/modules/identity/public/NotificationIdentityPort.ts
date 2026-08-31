import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { QueryResult, QueryResultRow } from 'pg';

export interface IdentityChallenge {
  readonly purpose: string;
  readonly code_ciphertext: string;
  readonly destination_ciphertext: string;
}

export interface IdentityChallengeAttempt {
  readonly sequence: number;
  readonly state: 'sending' | 'sent' | 'ambiguous';
  readonly dispatch: boolean;
}

export interface NotificationIdentityPort {
  recipient(database: OperationDatabase, membership: string): Promise<QueryResult<{ id: string; subject_ciphertext: string }>>;
  challenge(database: OperationDatabase, id: string): Promise<QueryResult<IdentityChallenge>>;
  beginAttempt(database: OperationDatabase, id: string, provider: string): Promise<QueryResult<IdentityChallengeAttempt>>;
  completeAttempt(database: OperationDatabase, id: string, sequence: number, provider: string, external: string): Promise<QueryResult<QueryResultRow>>;
  failAttempt(database: OperationDatabase, id: string, sequence: number, code: string): Promise<QueryResult<QueryResultRow>>;
  ambiguousAttempt(database: OperationDatabase, id: string, sequence: number, code: string): Promise<QueryResult<QueryResultRow>>;
}

export const NOTIFICATION_IDENTITY_PORT = publicPort<NotificationIdentityPort>('identity', 'notification');
