import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface IdentityChallenge {
  readonly purpose: string;
  readonly codeCiphertext: string;
  readonly destinationCiphertext: string;
}

export interface IdentityChallengeAttempt {
  readonly sequence: number;
  readonly state: 'sending' | 'sent' | 'ambiguous';
  readonly dispatch: boolean;
}

export interface NotificationIdentityPort {
  recipient(context: ReadTransactionContext, membership: string): Promise<Readonly<{ id: string; subjectCiphertext: string }> | null>;
  challenge(context: ReadTransactionContext, id: string): Promise<IdentityChallenge | null>;
  beginAttempt(context: WriteTransactionContext, id: string, provider: string): Promise<IdentityChallengeAttempt | null>;
  completeAttempt(context: WriteTransactionContext, id: string, sequence: number, provider: string, external: string): Promise<boolean>;
  failAttempt(context: WriteTransactionContext, id: string, sequence: number, code: string): Promise<void>;
  ambiguousAttempt(context: WriteTransactionContext, id: string, sequence: number, code: string): Promise<void>;
}

export const NOTIFICATION_IDENTITY_PORT = publicPort<NotificationIdentityPort>('identity', 'notification');
