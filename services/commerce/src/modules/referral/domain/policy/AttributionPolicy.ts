import type { ReferralBinding } from '../model/ReferralBinding';

export class AttributionPolicy {
  choose(existing: ReferralBinding | undefined, candidate: ReferralBinding): ReferralBinding {
    if (existing === undefined) return candidate;
    if (existing.scopeId !== candidate.scopeId || existing.customerId !== candidate.customerId) throw new Error('REFERRAL_BINDING_SCOPE_INVALID');
    return existing;
  }
}
