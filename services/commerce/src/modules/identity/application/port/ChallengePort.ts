import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface ChallengeIssue {
  readonly id: string;
  readonly principal: string | null;
  readonly purpose: string;
  readonly destinationHash: string;
  readonly codeHash: string;
  readonly codeCiphertext: string;
  readonly codeKeyVersion: string;
  readonly destinationCiphertext: string;
  readonly destinationKeyVersion: string;
  readonly scope: string | null;
  readonly ttlMinutes: 5 | 10;
  readonly queueDelivery: boolean;
}

export interface IssuedChallenge {
  readonly id: string;
  readonly purpose: string;
  readonly expiresAt: Date;
}

export interface ChallengePort {
  issue(context: WriteTransactionContext, challenge: ChallengeIssue): Promise<IssuedChallenge>;
  consume(
    context: WriteTransactionContext,
    challenge: string,
    code: string,
    digest: (id: string, code: string) => string,
    principal?: string,
    expected?: Readonly<{ purpose?: string; destinationHash?: string }>
  ): Promise<{ principal_id: string | null }>;
  verify(context: WriteTransactionContext, challenge: string, code: string, digest: (id: string, code: string) => string, expected: Readonly<{ purpose: string; destinationHash: string }>): Promise<{ principal_id: string | null }>;
  throttle(context: WriteTransactionContext, keys: readonly (readonly [string, string])[]): Promise<void>;
}

export interface LoginGuardPort {
  assertAllowed(context: WriteTransactionContext, keys: readonly (readonly [string, string])[]): Promise<void>;
  recordFailure(context: WriteTransactionContext, keys: readonly (readonly [string, string])[]): Promise<void>;
  clear(context: WriteTransactionContext, subjectHashes: readonly string[], client: string): Promise<void>;
}
