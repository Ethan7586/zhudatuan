export const CakeStockSource = Object.freeze({ stock: 'cake.slot.pull' });

export function reserveCakeSlot(remaining: number, quantity: number): number {
  if (!Number.isSafeInteger(remaining) || !Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('CAKE_SLOT_QUANTITY_INVALID');
  if (remaining < quantity) throw new Error('CAKE_SLOT_INVENTORY_INSUFFICIENT');
  return remaining - quantity;
}
