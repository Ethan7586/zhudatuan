export function databaseSafeInteger(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed)) throw new Error('DATABASE_INTEGER_INVALID');
  return parsed;
}

export function databaseInteger(value: unknown): number {
  const parsed = databaseSafeInteger(value);
  if (parsed < 0) throw new Error('DATABASE_INTEGER_INVALID');
  return parsed;
}
