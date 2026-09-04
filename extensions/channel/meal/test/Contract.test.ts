import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore/test';
import { MealCapabilities, MealWebhook } from '../capability';
import { MealProvider } from '../Factory';
import { checkMealHealth, mapMealError, MealMapper } from '../integration';
import { manifest } from '../Manifest';

describe('meal provider contract', () => {
  it('declares a signed and fully implemented required provider', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('meal');
    expect(() => assertProviderCapabilities(MealProvider.definition, MealCapabilities)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
  });
  it('passes shared quality contracts', async () => {
    await assertProviderQuality({ factory: MealProvider, manifest: manifest('signed'), mapper: new MealMapper(), mapError: mapMealError, webhook: MealWebhook, health: () => checkMealHealth({ health: async () => true }) });
  });
});
