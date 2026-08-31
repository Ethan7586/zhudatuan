import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore';
import { mapBookError } from '../ErrorMap';
import { BookProvider } from '../Factory';
import { checkBookHealth } from '../Health';
import { manifest } from '../Manifest';
import { BookMapper } from '../Mapper';
import { BookWebhook } from '../Webhook';
import { BookOperations } from '../capability';

describe('book provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('book');
    expect(BookProvider.definition.id).toBe('book');
    expect(() => assertProviderCapabilities(BookProvider.definition, BookOperations)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('BOOK_MANIFEST_SIGNATURE_MISSING');
  });
  it('verifies mapping, failure, webhook, health, timeout, retry and circuit contracts', async () => {
    await assertProviderQuality({ factory: BookProvider, manifest: manifest('signed'), mapper: new BookMapper(), mapError: mapBookError, webhook: BookWebhook, health: () => checkBookHealth({ health: async () => true }) });
  });
});
