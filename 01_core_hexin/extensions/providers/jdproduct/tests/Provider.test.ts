import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { JdproductProvider } from '../Provider';
import { manifest } from '../manifest';

describe('jdproduct provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('jdproduct');
    expect(JdproductProvider.definition.id).toBe('jdproduct');
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('JDPRODUCT_MANIFEST_SIGNATURE_MISSING');
  });
});
