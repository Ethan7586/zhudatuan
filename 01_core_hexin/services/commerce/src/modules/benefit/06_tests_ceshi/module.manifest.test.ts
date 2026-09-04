import { describe, expect, it } from 'vitest';
import * as benefitPublic from '..';
import { BENEFIT_CAPABILITIES, benefitManifest } from '..';

describe('benefit module manifest', () => {
  it('keeps the stable benefit identity and lightweight public entry', () => {
    expect(benefitManifest.id).toBe('benefit');
    expect(benefitManifest.publicEntry).toBe('./index.ts');
    expect(benefitManifest.provides).toEqual([BENEFIT_CAPABILITIES.read, BENEFIT_CAPABILITIES.manage]);
    expect(benefitPublic).toHaveProperty('BenefitPort');
    expect(benefitPublic).not.toHaveProperty('BenefitModule');
    expect(benefitPublic).not.toHaveProperty('benefitOperations');
    expect(benefitPublic).not.toHaveProperty('BenefitJobProcessor');
    expect(benefitPublic).not.toHaveProperty('BenefitDeadletter');
  });

  it('declares benefit dependencies, layers, and entrypoints', () => {
    expect(benefitManifest.requires).toEqual(['member', 'finance']);
    expect(benefitManifest.layers).toEqual(['public', 'domain', 'application', 'adapters', 'interface', 'tests']);
    expect(benefitManifest.entrypoints.http).toEqual(['benefitOperations']);
    expect(benefitManifest.entrypoints.jobs).toEqual(['benefitgrant', 'benefitexpiry']);
  });

  it('declares the benefit operation inventory', () => {
    expect(benefitManifest.operations).toEqual([
      'benefit.accounts.read',
      'benefit.ledgers.read',
      'benefit.plans.read',
      'benefit.plans.manage',
      'benefit.budgets.read',
      'benefit.budgets.manage',
      'benefit.grants.create',
      'benefit.grants.decide',
      'benefit.grants.read',
      'benefit.grants.control',
      'benefit.grants.revoke',
      'benefit.lots.read',
    ]);
  });

  it('declares benefit event ownership', () => {
    expect(benefitManifest.publishes).toEqual([
      'benefit.granted',
      'benefit.expired',
      'benefit.expiry.reminded',
      'benefit.revoked',
      'benefit.grant.failed',
      'benefit.revoke.failed',
      'benefit.expiry.failed',
    ]);
    expect(benefitManifest.consumes).toEqual([]);
  });
});
