import { describe, expect, it } from 'vitest';
import { canAccessNavigationTarget } from './NavigationAccess';

describe('navigation access', () => {
  it('requires both the operation capability and its authorization permission', () => {
    expect(canAccessNavigationTarget('qualification', ['qualification.read'], [])).toBe(false);
    expect(canAccessNavigationTarget('qualification', [], ['qualification.center.read'])).toBe(false);
    expect(canAccessNavigationTarget('qualification', ['qualification.read'], ['qualification.center.read'])).toBe(true);
  });

  it('keeps custom referral capabilities independent from B2B channel access', () => {
    const permissions = ['referral.settings.read'];
    const capabilities = ['referral.settings.read'];
    expect(canAccessNavigationTarget('referralsettings', permissions, capabilities)).toBe(true);
    expect(canAccessNavigationTarget('channels', permissions, capabilities)).toBe(false);
  });

  it('does not block routes outside the navigation access catalog', () => {
    expect(canAccessNavigationTarget('not-in-catalog', [], [])).toBe(true);
  });
});
