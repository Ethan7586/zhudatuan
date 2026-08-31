export function formatMinor(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor)) throw new Error('INVALID_MONEY_MINOR');
  return (amountMinor / 100).toFixed(2);
}
