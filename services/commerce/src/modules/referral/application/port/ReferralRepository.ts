import type { QueryPage } from '../../../../foundation/interface/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface EligibleMember {
  readonly memberId: string;
  readonly scopeId: string;
  readonly version: number;
}

export interface ReferralMemberSnapshot {
  readonly id: string;
  readonly scopeId: string;
  readonly memberId: string;
  readonly state: 'applied' | 'active' | 'disqualified';
  readonly version: number;
  readonly makerId: string;
}

export interface ReferralRepository {
  eligible(context: ReadTransactionContext, scope: string, membership: string): Promise<EligibleMember | null>;
  setting(context: ReadTransactionContext, scope: string): Promise<Readonly<Record<string, unknown>> | null>;
  manageSetting(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scopeId: string; enabled: boolean; firstTouchDays: number; rateBasisPoints: number; minimumWithdrawalMinor: number; currency: string; expectedVersion: number }>
  ): Promise<Readonly<Record<string, unknown>>>;
  products(context: ReadTransactionContext, scope: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  manageProduct(context: WriteTransactionContext, input: Readonly<{ id: string; scopeId: string; productId: string; enabled: boolean; rateBasisPoints: number; expectedVersion: number }>): Promise<Readonly<Record<string, unknown>>>;
  members(context: ReadTransactionContext, scope: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  member(context: WriteTransactionContext, scope: string, id: string): Promise<ReferralMemberSnapshot | null>;
  applyMember(context: WriteTransactionContext, input: Readonly<{ id: string; scopeId: string; memberId: string; displayName: string; mobile: string; makerId: string; reason: string }>): Promise<Readonly<Record<string, unknown>>>;
  decideMember(context: WriteTransactionContext, input: Readonly<{ id: string; scopeId: string; actorId: string; expectedVersion: number; next: 'active' | 'disqualified'; reason: string }>): Promise<Readonly<Record<string, unknown>>>;
  bindings(context: ReadTransactionContext, scope: string, customer: string | null, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  binding(context: WriteTransactionContext, scope: string, customer: string): Promise<Readonly<Record<string, unknown>> | null>;
  bind(context: WriteTransactionContext, input: Readonly<{ id: string; scopeId: string; customerId: string; promoterId: string; fingerprint: string; source: string }>): Promise<Readonly<Record<string, unknown>>>;
  link(context: ReadTransactionContext, scope: string, member: string): Promise<Readonly<{ promoterId: string; settingVersion: number; firstTouchDays: number }> | null>;
}
