import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore/test';
import { TmallCapabilities, TmallWebhook } from '../capability';
import { TmallProvider } from '../Factory';
import { checkTmallHealth, mapTmallError, TmallMapper } from '../integration';
import { manifest } from '../Manifest';

describe('tmall provider contract', () => {
  it('declares a signed and fully implemented required provider', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('tmall');
    expect(() => assertProviderCapabilities(TmallProvider.definition, TmallCapabilities)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
  });
  it('passes shared quality contracts', async () => {
    await assertProviderQuality({ factory: TmallProvider, manifest: manifest('signed'), mapper: new TmallMapper(), mapError: mapTmallError, webhook: TmallWebhook, health: () => checkTmallHealth({ health: async () => true }) });
  });
});
