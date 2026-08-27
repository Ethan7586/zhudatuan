import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { JdfreshProvider } from '../Provider';
import { manifest } from '../manifest';

describe('jdfresh provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('jdfresh');
    expect(JdfreshProvider.definition.id).toBe('jdfresh');
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('JDFRESH_MANIFEST_SIGNATURE_MISSING');
  });
});
