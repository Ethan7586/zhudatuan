export function currentListingPrice(row: Readonly<Record<string, unknown>>, at = Date.now()): boolean {
  const effective = typeof row.effectiveAt === 'string' ? Date.parse(row.effectiveAt) : Number.NEGATIVE_INFINITY;
  const expires = typeof row.expiresAt === 'string' ? Date.parse(row.expiresAt) : Number.POSITIVE_INFINITY;
  const amount = Number(row.amountMinor);
  return row.bookStatus === 'active' && Number.isSafeInteger(amount) && amount >= 0 && effective <= at && expires > at;
}

export function saleableListingStock(row: Readonly<Record<string, unknown>>): number | null {
  const onhand = Number(row.onhand);
  const safety = Number(row.safety);
  const reserved = Number(row.reserved ?? 0);
  if (row.status !== 'active' || ![onhand, safety, reserved].every(Number.isFinite)) return null;
  return Math.max(0, onhand - safety - reserved);
}
