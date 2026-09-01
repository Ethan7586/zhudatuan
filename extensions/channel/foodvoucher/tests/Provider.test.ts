import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore';
import { mapFoodvoucherError } from '../ErrorMap';
import { FoodvoucherProvider } from '../Factory';
import { checkFoodvoucherHealth } from '../Health';
import { manifest } from '../Manifest';
import { FoodvoucherMapper } from '../Mapper';
import { FoodvoucherWebhook } from '../Webhook';
import { FoodvoucherCapabilities } from '../capability';

describe('foodvoucher provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('foodvoucher');
    expect(FoodvoucherProvider.definition.id).toBe('foodvoucher');
    expect(() => assertProviderCapabilities(FoodvoucherProvider.definition, FoodvoucherCapabilities)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('FOODVOUCHER_MANIFEST_SIGNATURE_MISSING');
  });
  it('verifies mapping, failure, webhook, health, timeout, retry and circuit contracts', async () => {
    await assertProviderQuality({
      factory: FoodvoucherProvider,
      manifest: manifest('signed'),
      mapper: new FoodvoucherMapper(),
      mapError: mapFoodvoucherError,
      webhook: FoodvoucherWebhook,
      health: () => checkFoodvoucherHealth({ health: async () => true }),
    });
  });
});
