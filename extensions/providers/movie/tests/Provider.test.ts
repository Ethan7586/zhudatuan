import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { MovieProvider } from '../Provider';
import { manifest } from '../manifest';

describe('movie provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('movie');
    expect(MovieProvider.definition.id).toBe('movie');
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('MOVIE_MANIFEST_SIGNATURE_MISSING');
  });
});
