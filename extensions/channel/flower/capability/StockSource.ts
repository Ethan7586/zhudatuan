export const FlowerStockSource = Object.freeze({ stock: 'flower.slot.pull' });

export interface FlowerAvailability {
  readonly requestsPerSecond: number;
  readonly sku: string;
  readonly substituted: boolean;
}

export function flowerAvailability(input: Readonly<{ holiday: boolean; ordinaryLimit: number; holidayLimit: number; available: boolean; sku: string; substitutes: readonly string[] }>): FlowerAvailability {
  const requestsPerSecond = input.holiday ? input.holidayLimit : input.ordinaryLimit;
  if (!Number.isSafeInteger(requestsPerSecond) || requestsPerSecond <= 0) throw new Error('FLOWER_RATE_LIMIT_INVALID');
  if (input.available) return Object.freeze({ requestsPerSecond, sku: input.sku, substituted: false });
  const replacement = input.substitutes.find((sku) => sku.trim());
  if (!replacement) throw new Error('FLOWER_SUBSTITUTE_UNAVAILABLE');
  return Object.freeze({ requestsPerSecond, sku: replacement, substituted: true });
}
