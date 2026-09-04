import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore/test';
import { FoodvoucherCapabilities, FoodvoucherWebhook } from '../capability';
import { FoodvoucherProvider } from '../Factory';
import { checkFoodvoucherHealth, FoodvoucherMapper, mapFoodvoucherError } from '../integration';
import { manifest } from '../Manifest';

describe('foodvoucher provider contract', () => {
  it('declares a signed and fully implemented required provider', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('foodvoucher');
    expect(() => assertProviderCapabilities(FoodvoucherProvider.definition, FoodvoucherCapabilities)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
  });
  it('passes shared quality contracts', async () => {
    await assertProviderQuality({ factory: FoodvoucherProvider, manifest: manifest('signed'), mapper: new FoodvoucherMapper(), mapError: mapFoodvoucherError, webhook: FoodvoucherWebhook, health: () => checkFoodvoucherHealth({ health: async () => true }) });
  });
});
