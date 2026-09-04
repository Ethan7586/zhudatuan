import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore/test';
import { CakeCapabilities, CakeWebhook } from '../capability';
import { CakeProvider } from '../Factory';
import { CakeMapper, checkCakeHealth, mapCakeError } from '../integration';
import { manifest } from '../Manifest';

describe('cake provider contract', () => {
  it('declares a signed and fully implemented required provider', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('cake');
    expect(() => assertProviderCapabilities(CakeProvider.definition, CakeCapabilities)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
  });
  it('passes shared quality contracts', async () => {
    await assertProviderQuality({ factory: CakeProvider, manifest: manifest('signed'), mapper: new CakeMapper(), mapError: mapCakeError, webhook: CakeWebhook, health: () => checkCakeHealth({ health: async () => true }) });
  });
});
