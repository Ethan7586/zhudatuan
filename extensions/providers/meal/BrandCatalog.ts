import { CAKEUNCLE_MEAL_BRANDS, type CakeuncleMealBrand } from '@shop/vendorcakeuncle';
import type { VendorConnection } from '@shop/vendorcore';

export const MEAL_BRANDS = Object.freeze(['sbk', 'kfc', 'mcd', 'lk', 'cot', 'pzh', 'molly'] as const);
export type MealBrand = (typeof MEAL_BRANDS)[number];

export const MEAL_BRAND_NAMES: Readonly<Record<MealBrand, string>> = Object.freeze({
  sbk: 'STARBUCKS', kfc: 'KFC', mcd: 'MCDONALDS', lk: 'LUCKIN', cot: 'COTTI', pzh: 'PIZZAHUT', molly: 'MOLLYTEA',
});

export interface MealCatalogScope {
  readonly operation: string;
  readonly brand: MealBrand;
  readonly storeCode: string;
}

/** Non-secret store scope is encoded in endpoint keys: meal.menu.<brand>.<urlencoded-store-code>. */
export function mealCatalogScopes(connection: VendorConnection): readonly MealCatalogScope[] {
  const scopes = Object.entries(connection.endpoints).flatMap(([operation, path]) => {
    const match = /^meal\.menu\.(sbk|kfc|mcd|lk|cot|pzh|molly)\.(.+)$/.exec(operation);
    if (!match) return [];
    const brand = match[1] as CakeuncleMealBrand;
    if (path !== CAKEUNCLE_MEAL_BRANDS[brand].menu) throw new Error('MEAL_MENU_ENDPOINT_INVALID');
    let storeCode: string;
    try { storeCode = decodeURIComponent(match[2]!); } catch { throw new Error('MEAL_STORE_CODE_INVALID'); }
    if (!storeCode || storeCode !== storeCode.trim() || storeCode.length > 128 || /[\u0000-\u001f\u007f]/.test(storeCode)) {
      throw new Error('MEAL_STORE_CODE_INVALID');
    }
    return [{ operation, brand, storeCode }];
  }).sort((left, right) => left.operation.localeCompare(right.operation, 'en'));
  if (!scopes.length) throw new Error('MEAL_CATALOG_SCOPE_MISSING');
  const unique = new Set(scopes.map(({ brand, storeCode }) => `${brand}:${storeCode}`));
  if (unique.size !== scopes.length) throw new Error('MEAL_CATALOG_SCOPE_DUPLICATE');
  return Object.freeze(scopes);
}
