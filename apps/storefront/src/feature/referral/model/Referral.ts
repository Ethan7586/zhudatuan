export interface ReferralAttributionInput {
  readonly search: string;
  readonly mallId: string;
  readonly memberId: string;
}

export type ReferralAttributionResult =
  | Readonly<{ status: 'ignored'; reason: 'absent' | 'malformed' | 'untrusted-context' }>
  | Readonly<{ status: 'deduplicated' }>
  | Readonly<{ status: 'bound'; candidateWon: boolean }>
  | Readonly<{ status: 'failed' }>;
