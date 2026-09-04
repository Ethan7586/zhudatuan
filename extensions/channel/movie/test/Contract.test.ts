import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore/test';
import { MovieCapabilities, MovieWebhook } from '../capability';
import { MovieProvider } from '../Factory';
import { checkMovieHealth, mapMovieError, MovieMapper } from '../integration';
import { manifest } from '../Manifest';

describe('movie provider contract', () => {
  it('declares a signed and fully implemented required provider', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('movie');
    expect(() => assertProviderCapabilities(MovieProvider.definition, MovieCapabilities)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
  });
  it('passes shared quality contracts', async () => {
    await assertProviderQuality({ factory: MovieProvider, manifest: manifest('signed'), mapper: new MovieMapper(), mapError: mapMovieError, webhook: MovieWebhook, health: () => checkMovieHealth({ health: async () => true }) });
  });
});
