import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore/test';
import { ChargeCapabilities, ChargeWebhook } from '../capability';
import { ChargeProvider } from '../Factory';
import { ChargeMapper, checkChargeHealth, mapChargeError } from '../integration';
import { manifest } from '../Manifest';

describe('charge provider contract', () => {
  it('declares a signed and fully implemented required provider', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('charge');
    expect(() => assertProviderCapabilities(ChargeProvider.definition, ChargeCapabilities)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
  });
  it('passes shared quality contracts', async () => {
    await assertProviderQuality({ factory: ChargeProvider, manifest: manifest('signed'), mapper: new ChargeMapper(), mapError: mapChargeError, webhook: ChargeWebhook, health: () => checkChargeHealth({ health: async () => true }) });
  });
});
