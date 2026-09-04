import type { JsonObject } from '@shop/contract';

export function wanlianReference(source: JsonObject): string {
  const value = source.tradeNo;
  if (typeof value !== 'string' || !value.trim()) throw new Error('WANLIAN_TRADE_REFERENCE_INVALID');
  return value.trim();
}

export function wanlianTimestamp(source: JsonObject): string {
  const value = source.updatedAt;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('WANLIAN_TIMESTAMP_INVALID');
  return new Date(value).toISOString();
}
