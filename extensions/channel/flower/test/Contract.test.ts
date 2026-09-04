import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore/test';
import { FlowerCapabilities, FlowerWebhook } from '../capability';
import { FlowerProvider } from '../Factory';
import { checkFlowerHealth, FlowerMapper, mapFlowerError } from '../integration';
import { manifest } from '../Manifest';

describe('flower provider contract', () => {
  it('declares a signed and fully implemented required provider', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('flower');
    expect(() => assertProviderCapabilities(FlowerProvider.definition, FlowerCapabilities)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
  });
  it('passes shared quality contracts', async () => {
    await assertProviderQuality({ factory: FlowerProvider, manifest: manifest('signed'), mapper: new FlowerMapper(), mapError: mapFlowerError, webhook: FlowerWebhook, health: () => checkFlowerHealth({ health: async () => true }) });
  });
});
