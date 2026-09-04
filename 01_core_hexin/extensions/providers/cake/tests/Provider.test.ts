import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { CakeProvider } from '../Provider';
import { manifest } from '../manifest';

describe('cake provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('cake');
    expect(CakeProvider.definition.id).toBe('cake');
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('CAKE_MANIFEST_SIGNATURE_MISSING');
  });
});
