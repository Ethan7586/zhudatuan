export function latestWatermark(values: readonly string[]): string | null {
  return values.length === 0 ? null : [...values].sort().at(-1)!;
}
