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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    expect(MEAL_BRANDS).toEqual(['sbk', 'kfc', 'mcd', 'lk', 'cot', 'pzh', 'molly']);
    expect(MealProvider.definition.capabilities).toEqual(['Catalog', 'Price']);
    expect(MealProvider.definition.secretRefs).toEqual(['channelNo', 'channelKey']);
=======
    expect(MEAL_BRANDS).toEqual(['KFC', 'MCDONALDS', 'LUCKIN', 'STARBUCKS', 'COTTI']);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    expect(MEAL_BRANDS).toEqual(['sbk', 'kfc', 'mcd', 'lk', 'cot', 'pzh', 'molly']);
    expect(MealProvider.definition.capabilities).toEqual(['Catalog', 'Price']);
    expect(MealProvider.definition.secretRefs).toEqual(['channelNo', 'channelKey']);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    expect(MEAL_BRANDS).toEqual(['KFC', 'MCDONALDS', 'LUCKIN', 'STARBUCKS', 'COTTI']);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  });
});
