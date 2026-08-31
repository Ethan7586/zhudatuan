export function textValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return fallback;
}

export function nullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = textValue(value);
  return text || null;
}
