import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { DirectchargeProvider } from '../Provider';
import { manifest } from '../manifest';

describe('directcharge provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('directcharge');
    expect(DirectchargeProvider.definition.id).toBe('directcharge');
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('DIRECTCHARGE_MANIFEST_SIGNATURE_MISSING');
  });
});
