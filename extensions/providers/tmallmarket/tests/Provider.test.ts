import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { TmallmarketProvider } from '../Provider';
import { manifest } from '../manifest';

describe('tmallmarket provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('tmallmarket');
    expect(TmallmarketProvider.definition.id).toBe('tmallmarket');
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('TMALLMARKET_MANIFEST_SIGNATURE_MISSING');
  });
});
