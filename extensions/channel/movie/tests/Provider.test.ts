import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore';
import { mapMovieError } from '../ErrorMap';
import { MovieProvider } from '../Factory';
import { checkMovieHealth } from '../Health';
import { manifest } from '../Manifest';
import { MovieMapper } from '../Mapper';
import { MovieWebhook } from '../Webhook';
import { MovieOperations } from '../capability';

describe('movie provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('movie');
    expect(MovieProvider.definition.id).toBe('movie');
    expect(() => assertProviderCapabilities(MovieProvider.definition, MovieOperations)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('MOVIE_MANIFEST_SIGNATURE_MISSING');
  });
  it('verifies mapping, failure, webhook, health, timeout, retry and circuit contracts', async () => {
    await assertProviderQuality({ factory: MovieProvider, manifest: manifest('signed'), mapper: new MovieMapper(), mapError: mapMovieError, webhook: MovieWebhook, health: () => checkMovieHealth({ health: async () => true }) });
  });
});
