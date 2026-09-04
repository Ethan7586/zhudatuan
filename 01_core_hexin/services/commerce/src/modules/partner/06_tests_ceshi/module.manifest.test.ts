import { describe, expect, it } from 'vitest';
import { PARTNER_CAPABILITIES, partnerManifest } from '..';

describe('partner module manifest', () => {
  it('keeps the stable partner identity and public entry', () => {
    expect(partnerManifest.id).toBe('partner');
    expect(partnerManifest.publicEntry).toBe('./index.ts');
    expect(partnerManifest.provides).toEqual(Object.values(PARTNER_CAPABILITIES));
  });

  it('declares partner operations and module entrypoints', () => {
    expect(partnerManifest.operations).toEqual([
      'partner.partners.read',
      'partner.partners.manage',
      'organization.stores.read',
      'organization.stores.manage',
    ]);
    expect(partnerManifest.entrypoints.http).toEqual(['partnerOperations']);
  });
});
