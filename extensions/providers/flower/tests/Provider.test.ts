import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { FlowerProvider } from '../Provider';
import { manifest } from '../manifest';

describe('flower provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('flower');
    expect(FlowerProvider.definition.id).toBe('flower');
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('FLOWER_MANIFEST_SIGNATURE_MISSING');
  });
});
