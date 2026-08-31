import type { ReferralRows } from './ReferralRepository';

export interface WithdrawalRepository {
  read(scopeId: string, memberId: string, cursor: string | null, limit: number): Promise<ReferralRows>;
  position(scopeId: string, memberId: string): Promise<ReferralRows>;
  create(input: Readonly<{ id: string; scopeId: string; memberId: string; amountMinor: number; currency: string; accountRef: string; expectedVersion: number }>): Promise<ReferralRows>;
}
