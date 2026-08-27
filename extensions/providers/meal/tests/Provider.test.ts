import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { MealProvider } from '../Provider';
import { manifest } from '../manifest';
import { MEAL_BRANDS } from '../BrandCatalog';

describe('meal provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('meal');
    expect(MealProvider.definition.id).toBe('meal');
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('MEAL_MANIFEST_SIGNATURE_MISSING');
    expect(MEAL_BRANDS).toEqual(['KFC', 'MCDONALDS', 'LUCKIN', 'STARBUCKS', 'COTTI']);
  });
});
