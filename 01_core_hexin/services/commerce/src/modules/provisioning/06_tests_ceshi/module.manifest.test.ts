import { describe, expect, it } from 'vitest';
import * as provisioningPublic from '..';
import { provisioningManifest } from '..';

describe('provisioning module manifest', () => {
  it('keeps the stable provisioning identity and lightweight public entry', () => {
    expect(provisioningManifest.id).toBe('provisioning');
    expect(provisioningManifest.publicEntry).toBe('./index.ts');
    expect(provisioningManifest.provides).toEqual([]);
    expect(provisioningPublic).toHaveProperty('MallOwnerProvisioningPort');
    expect(provisioningPublic).toHaveProperty('DomainPurchaseLifecycle');
    expect(provisioningPublic).toHaveProperty('DomainPurchasePolicy');
    expect(provisioningPublic).not.toHaveProperty('CreateMall');
    expect(provisioningPublic).not.toHaveProperty('ProvisioningModule');
    expect(provisioningPublic).not.toHaveProperty('MallProvisioningModule');
    expect(provisioningPublic).not.toHaveProperty('provisioningOperations');
  });

  it('declares provisioning dependencies, layers, and entrypoints', () => {
    expect(provisioningManifest.requires).toEqual(['organization', 'catalog', 'experience']);
    expect(provisioningManifest.layers).toEqual(['public', 'domain', 'application', 'interface', 'tests']);
    expect(provisioningManifest.entrypoints.http).toEqual(['provisioningOperations']);
    expect(provisioningManifest.entrypoints.jobs).toEqual([]);
  });

  it('declares the complete provisioning operation inventory', () => {
    expect(provisioningManifest.operations).toEqual([
      'provisioning.malls.create',
      'provisioning.malls.read',
    ]);
  });

  it('declares no provisioning event ownership or consumers', () => {
    expect(provisioningManifest.publishes).toEqual([]);
    expect(provisioningManifest.consumes).toEqual([]);
  });
});
