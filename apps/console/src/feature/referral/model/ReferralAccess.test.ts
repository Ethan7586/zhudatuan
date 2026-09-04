import { describe, expect, it } from 'vitest';
import { decideReferralAccess } from './ReferralAccess';

const access = Object.freeze({ permissions: Object.freeze(['referral.setting.read']), capabilities: Object.freeze(['referral.settings.read']) });

describe('Referral scope access', () => {
  it('fails closed for a non-mall scope without issuing mall-scoped reads', () => {
    expect(decideReferralAccess({ scope: { kind: 'enterprise' }, session: access }, 'referral.settings.read')).toEqual({ allowed: false, reason: '分销返佣仅在商城范围可用，请先切换到具体商城。' });
  });

  it('requires the operation permission and capability for a concrete mall', () => {
    expect(decideReferralAccess({ scope: { kind: 'mall' }, session: access }, 'referral.settings.read')).toEqual({ allowed: true });
    expect(decideReferralAccess({ scope: { kind: 'mall' }, session: { permissions: [], capabilities: access.capabilities } }, 'referral.settings.read').allowed).toBe(false);
    expect(decideReferralAccess({ scope: { kind: 'mall' }, session: { permissions: access.permissions, capabilities: [] } }, 'referral.settings.read').allowed).toBe(false);
  });
});
