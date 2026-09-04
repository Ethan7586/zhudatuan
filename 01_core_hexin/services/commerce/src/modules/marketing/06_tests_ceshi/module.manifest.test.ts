import { describe, expect, it } from 'vitest';
import { MARKETING_CAPABILITIES, marketingManifest } from '..';

describe('marketing module manifest', () => {
  it('keeps the stable marketing identity and public entry', () => {
    expect(marketingManifest.id).toBe('marketing');
    expect(marketingManifest.publicEntry).toBe('./index.ts');
    expect(marketingManifest.provides).toEqual(Object.values(MARKETING_CAPABILITIES));
  });

  it('declares marketing operations and module entrypoints', () => {
    expect(marketingManifest.operations).toEqual(['marketing.campaigns.read']);
    expect(marketingManifest.entrypoints.http).toEqual(['marketingOperations']);
  });
});
