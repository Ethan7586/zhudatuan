import { describe, expect, it } from 'vitest';
import { ORGANIZATION_CAPABILITIES, organizationManifest } from '..';

describe('organization module manifest', () => {
  it('keeps the stable organization identity and public entry', () => {
    expect(organizationManifest.id).toBe('organization');
    expect(organizationManifest.publicEntry).toBe('./index.ts');
    expect(organizationManifest.provides).toEqual(Object.values(ORGANIZATION_CAPABILITIES));
  });

  it('declares organization operations and module entrypoints', () => {
    expect(organizationManifest.operations).toEqual(['organization.layers.read']);
    expect(organizationManifest.entrypoints.http).toEqual(['organizationOperations']);
  });
});
