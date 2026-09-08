export function orderTime(value: Date | string | null): string | null;
export function orderTime(value: Date | string): string;
export function orderTime(value: Date | string | null): string | null {
  if (value === null) return null;
  const instant = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new Error('ORDER_PROJECTION_TIME_INVALID');
  return instant.toISOString();
}
