export const MealStockSource = Object.freeze({ stock: 'meal.inventory.pull' });

export function validateMealSlot(input: Readonly<{ components: readonly Readonly<{ quantity: number }>[]; remaining: number }>): void {
  if (!input.components.length || input.components.some(({ quantity }) => !Number.isSafeInteger(quantity) || quantity <= 0)) throw new Error('MEAL_COMPOSITION_INVALID');
  if (!Number.isSafeInteger(input.remaining) || input.remaining <= 0) throw new Error('MEAL_SLOT_UNAVAILABLE');
}
