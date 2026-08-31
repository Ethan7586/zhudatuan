import { describe, expect, it } from 'vitest';
import { decideReferralAccess } from './ReferralAccess';

const access = Object.freeze({
  permissions: Object.freeze(['referral.setting.read']),
  capabilities: Object.freeze(['referral.settings.read']),
});

describe('referral scope access', () => {
  it('keeps the legacy enterprise navigation entry fail-closed without calling mall-scoped referral data', () => {
    expect(decideReferralAccess({ scope: { kind: 'enterprise' }, session: access }, 'referral.setting.read', 'referral.settings.read')).toEqual({
      allowed: false,
      reason: '分销返佣仅在商城范围可用，请先切换到具体商城。',
    });
  });

  it('allows a concrete mall only when both permission and capability are present', () => {
    expect(decideReferralAccess({ scope: { kind: 'mall' }, session: access }, 'referral.setting.read', 'referral.settings.read')).toEqual({ allowed: true });
    expect(decideReferralAccess({ scope: { kind: 'mall' }, session: { permissions: [], capabilities: access.capabilities } }, 'referral.setting.read', 'referral.settings.read').allowed).toBe(false);
    expect(decideReferralAccess({ scope: { kind: 'mall' }, session: { permissions: access.permissions, capabilities: [] } }, 'referral.setting.read', 'referral.settings.read').allowed).toBe(false);
  });
});
