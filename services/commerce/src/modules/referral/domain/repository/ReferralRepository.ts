import type { QueryResult, QueryResultRow } from 'pg';

export type ReferralRows = QueryResult<QueryResultRow>;

export interface ReferralRepository {
  setting(scopeId: string): Promise<ReferralRows>;
  manageSetting(input: Readonly<{ id: string; scopeId: string; enabled: boolean; firstTouchDays: number; rateBasisPoints: number; minimumWithdrawalMinor: number; currency: string; expectedVersion: number }>): Promise<ReferralRows>;
  products(scopeId: string, page: Readonly<{ cursor: string | null; limit: number }>): Promise<ReferralRows>;
  manageProduct(input: Readonly<{ id: string; scopeId: string; productId: string; enabled: boolean; rateBasisPoints: number; expectedVersion: number }>): Promise<ReferralRows>;
  members(scopeId: string, page: Readonly<{ cursor: string | null; limit: number }>): Promise<ReferralRows>;
  member(scopeId: string, id: string): Promise<ReferralRows>;
  applyMember(input: Readonly<{ id: string; scopeId: string; memberId: string; displayName: string; mobile: string; makerId: string; reason: string }>): Promise<ReferralRows>;
  decideMember(input: Readonly<{ id: string; scopeId: string; actorId: string; expectedVersion: number; next: 'active' | 'disqualified'; reason: string }>): Promise<ReferralRows>;
  bindings(scopeId: string, customerId: string | null, page: Readonly<{ cursor: string | null; limit: number }>): Promise<ReferralRows>;
  binding(scopeId: string, customerId: string): Promise<ReferralRows>;
  bind(input: Readonly<{ id: string; scopeId: string; customerId: string; promoterId: string; fingerprint: string; source: string }>): Promise<ReferralRows>;
}
