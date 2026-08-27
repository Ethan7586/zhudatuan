import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { PrivateProvider } from '../Provider';
import { manifest } from '../manifest';

describe('private provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('private');
    expect(PrivateProvider.definition.id).toBe('private');
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('PRIVATE_MANIFEST_SIGNATURE_MISSING');
  });
});
