export const MEAL_BRANDS = Object.freeze(['KFC', 'MCDONALDS', 'LUCKIN', 'STARBUCKS', 'COTTI'] as const);

export type MealBrand = (typeof MEAL_BRANDS)[number];
