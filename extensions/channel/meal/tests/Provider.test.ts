import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore';
import { mapMealError } from '../ErrorMap';
import { MealProvider } from '../Factory';
import { checkMealHealth } from '../Health';
import { manifest } from '../Manifest';
import { MealMapper } from '../Mapper';
import { MealWebhook } from '../Webhook';
import { MEAL_BRANDS } from '../BrandCatalog';
import { MealOperations } from '../capability';

describe('meal provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('meal');
    expect(MealProvider.definition.id).toBe('meal');
    expect(() => assertProviderCapabilities(MealProvider.definition, MealOperations)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('MEAL_MANIFEST_SIGNATURE_MISSING');
    expect(MEAL_BRANDS).toEqual(['KFC', 'MCDONALDS', 'LUCKIN', 'STARBUCKS', 'COTTI']);
  });
  it('verifies mapping, failure, webhook, health, timeout, retry and circuit contracts', async () => {
    await assertProviderQuality({ factory: MealProvider, manifest: manifest('signed'), mapper: new MealMapper(), mapError: mapMealError, webhook: MealWebhook, health: () => checkMealHealth({ health: async () => true }) });
  });
});
