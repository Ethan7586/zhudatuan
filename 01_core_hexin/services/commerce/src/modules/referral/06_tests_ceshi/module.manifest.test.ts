import { describe, expect, it } from 'vitest';
import { REFERRAL_CAPABILITIES, referralManifest } from '..';

describe('referral module manifest', () => {
  it('keeps the stable referral identity and lightweight public entry', () => {
    expect(referralManifest.id).toBe('referral');
    expect(referralManifest.publicEntry).toBe('./index.ts');
    expect(referralManifest.provides).toEqual([REFERRAL_CAPABILITIES.read, REFERRAL_CAPABILITIES.manage]);
  });

  it('declares referral dependencies, layers, and entrypoints', () => {
    expect(referralManifest.requires).toEqual(['member', 'catalog', 'finance']);
    expect(referralManifest.layers).toEqual(['public', 'domain', 'application', 'interface', 'tests']);
    expect(referralManifest.entrypoints.http).toEqual(['referralOperations', 'referralOperatorReadOperations']);
    expect(referralManifest.entrypoints.jobs).toEqual(['referral']);
  });

  it('declares the referral operation inventory', () => {
    expect(referralManifest.operations).toEqual([
      'referral.settings.read',
      'referral.settings.manage',
      'referral.products.read',
      'referral.products.manage',
      'referral.members.read',
      'referral.members.apply',
      'referral.members.approve',
      'referral.members.disqualify',
      'referral.bindings.read',
      'referral.bindings.create',
      'referral.commissions.read',
      'referral.earnings.read',
      'referral.links.read',
      'referral.withdrawals.read',
      'referral.withdrawals.create',
    ]);
  });

  it('declares referral event ownership', () => {
    expect(referralManifest.publishes).toEqual([]);
    expect(referralManifest.consumes).toEqual([
      'order.placed',
      'order.paid',
      'order.received',
      'order.cancelled',
      'payment.refunded',
    ]);
  });
});
