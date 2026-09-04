import { describe, expect, it } from 'vitest';
import { CAPABILITY_CAPABILITIES, capabilityManifest } from '..';

describe('capability module manifest', () => {
  it('keeps the stable capability identity and public entry', () => {
    expect(capabilityManifest.id).toBe('capability');
    expect(capabilityManifest.publicEntry).toBe('./index.ts');
    expect(capabilityManifest.provides).toEqual(Object.values(CAPABILITY_CAPABILITIES));
  });

  it('declares capability operations and module entrypoints', () => {
    expect(capabilityManifest.operations).toEqual([
      'capability.assignments.read',
      'capability.assignments.manage',
    ]);
    expect(capabilityManifest.entrypoints.http).toEqual(['capabilityOperations']);
  });
});
