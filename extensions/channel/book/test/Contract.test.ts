import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore/test';
import { BookCapabilities, BookWebhook } from '../capability';
import { BookProvider } from '../Factory';
import { BookMapper, checkBookHealth, mapBookError } from '../integration';
import { manifest } from '../Manifest';

describe('book provider contract', () => {
  it('declares a signed and fully implemented required provider', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('book');
    expect(() => assertProviderCapabilities(BookProvider.definition, BookCapabilities)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
  });
  it('passes shared quality contracts', async () => {
    await assertProviderQuality({ factory: BookProvider, manifest: manifest('signed'), mapper: new BookMapper(), mapError: mapBookError, webhook: BookWebhook, health: () => checkBookHealth({ health: async () => true }) });
  });
});
