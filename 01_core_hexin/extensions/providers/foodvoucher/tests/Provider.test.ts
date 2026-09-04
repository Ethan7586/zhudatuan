import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { FoodvoucherProvider } from '../Provider';
import { manifest } from '../manifest';

describe('foodvoucher provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('foodvoucher');
    expect(FoodvoucherProvider.definition.id).toBe('foodvoucher');
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('FOODVOUCHER_MANIFEST_SIGNATURE_MISSING');
  });
});
