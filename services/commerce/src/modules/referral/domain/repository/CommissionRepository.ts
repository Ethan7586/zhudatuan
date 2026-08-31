import type { ReferralRows } from './ReferralRepository';

export interface CommissionRepository {
  read(scopeId: string, beneficiaryId: string | null, cursor: string | null, limit: number): Promise<ReferralRows>;
  earnings(scopeId: string, beneficiaryId: string): Promise<ReferralRows>;
}
