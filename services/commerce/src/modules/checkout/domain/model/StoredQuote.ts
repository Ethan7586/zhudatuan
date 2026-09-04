import type { CheckoutQuote } from './CheckoutQuote';

export function storedQuote(value: unknown): CheckoutQuote {
  if (!record(value)) invalid();
  const source = value as Readonly<Record<string, unknown>>;
  const cart = source.cart;
  if (!record(cart) || !texts(cart, ['id', 'member', 'mall', 'application']) || !integer(cart.version)) invalid();
  if (!record(source.selection) || !Array.isArray(source.lines) || !Array.isArray(source.tenders) || !record(source.evidence) || !Array.isArray(source.rejections)) invalid();
  if (!integer(source.subtotalMinor) || !integer(source.discountMinor) || !integer(source.shippingMinor) || !integer(source.taxMinor) || !integer(source.payableMinor) || !integer(source.personalMinor) || source.currency !== 'CNY') invalid();
  if (!nullableSnapshot(source.address) || !nullableSnapshot(source.invoice) || !shipping(source.shipping) || !tax(source.tax)) invalid();
  for (const line of source.lines) {
    if (!record(line) || !texts(line, ['listing', 'sku', 'product', 'productType', 'category', 'title'])) invalid();
    if (!integers(line, ['quantity', 'unitMinor', 'totalMinor', 'discountMinor', 'payableMinor']) || !record(line.versions) || typeof line.accepted !== 'boolean' || !stringArray(line.reasons)) invalid();
    if (!(line.provider === null || typeof line.provider === 'string') || !(line.partner === null || typeof line.partner === 'string') || !(line.stockitem === null || typeof line.stockitem === 'string')) invalid();
  }
  return deepFreeze(value) as CheckoutQuote;
}

function nullableSnapshot(value: unknown): boolean {
  return value === null || (record(value) && 'value' in value && typeof value.version === 'string' && /^[0-9a-f]{64}$/.test(String(value.hash)));
}

function shipping(value: unknown): boolean {
  return record(value) && ['standard', 'express', 'pickup', 'digital'].includes(String(value.method)) && integer(value.amountMinor) && typeof value.version === 'string';
}

function tax(value: unknown): boolean {
  return record(value) && value.mode === 'included' && integer(value.amountMinor) && typeof value.version === 'string';
}

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function texts(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof value[key] === 'string');
}
function integer(value: unknown): boolean {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}
function integers(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  return keys.every((key) => integer(value[key]));
}
function stringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
function invalid(): never {
  throw new Error('QUOTE_PAYLOAD_INVALID');
}
function deepFreeze(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
