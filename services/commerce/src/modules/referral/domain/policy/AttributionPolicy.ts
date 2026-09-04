import type { ReferralBinding } from '../model/ReferralBinding';
import { ReferralRate } from '../value/ReferralRate';

export class AttributionPolicy {
  choose(existing: ReferralBinding | undefined, candidate: ReferralBinding, ancestors: readonly string[], now: Date): ReferralBinding {
    this.assertRelation(candidate, ancestors);
    if (Number.isNaN(now.getTime())) throw new Error('REFERRAL_ATTRIBUTION_TIME_INVALID');
    if (existing === undefined) return candidate;
    if (existing.scopeId !== candidate.scopeId || existing.customerId !== candidate.customerId) throw new Error('REFERRAL_BINDING_SCOPE_INVALID');
    if (existing.state === 'active' && (existing.expiresAt === null || Date.parse(existing.expiresAt) > now.getTime())) return existing;
    return candidate;
  }

  refundReversal(originalBaseMinor: bigint, refundedBaseMinor: bigint, rateBasisPoints: number): bigint {
    if (originalBaseMinor < 0n || refundedBaseMinor < 0n || refundedBaseMinor > originalBaseMinor) throw new Error('REFERRAL_REFUND_AMOUNT_INVALID');
    const rate = new ReferralRate(rateBasisPoints);
    return rate.apply(originalBaseMinor) - rate.apply(originalBaseMinor - refundedBaseMinor);
  }

  private assertRelation(candidate: ReferralBinding, ancestors: readonly string[]): void {
    if (candidate.customerId === candidate.promoterMemberId) throw new Error('REFERRAL_SELF_REFERRAL_FORBIDDEN');
    const visited = new Set<string>();
    for (const member of ancestors) {
      if (!member || visited.has(member)) throw new Error('REFERRAL_RELATION_PATH_INVALID');
      if (member === candidate.customerId) throw new Error('REFERRAL_CIRCULAR_REFERRAL_FORBIDDEN');
      visited.add(member);
    }
  }
}
