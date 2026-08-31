import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

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
  issue(database: OperationDatabase, challenge: ChallengeIssue): Promise<IssuedChallenge>;
  consume(
    database: OperationDatabase,
    challenge: string,
    code: string,
    digest: (id: string, code: string) => string,
    principal?: string,
    expected?: Readonly<{ purpose?: string; destinationHash?: string }>
  ): Promise<{ principal_id: string | null }>;
  verify(database: OperationDatabase, challenge: string, code: string, digest: (id: string, code: string) => string, expected: Readonly<{ purpose: string; destinationHash: string }>): Promise<{ principal_id: string | null }>;
  throttle(database: OperationDatabase, keys: readonly (readonly [string, string])[]): Promise<void>;
}

export interface LoginGuardPort {
  assertAllowed(database: OperationDatabase, keys: readonly (readonly [string, string])[]): Promise<void>;
  recordFailure(database: OperationDatabase, keys: readonly (readonly [string, string])[]): Promise<void>;
  clear(database: OperationDatabase, subjectHashes: readonly string[], client: string): Promise<void>;
}
