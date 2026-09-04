import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export class QuoteSigner {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = Buffer.from(secret, 'utf8');
    if (this.key.byteLength < 32) throw new Error('QUOTE_SIGNING_KEY_TOO_SHORT');
  }

  sign(value: unknown): string {
    return createHmac('sha256', this.key).update(canonicalQuote(value)).digest('hex');
  }

  verify(value: unknown, signature: string): boolean {
    if (!/^[0-9a-f]{64}$/.test(signature)) return false;
    return timingSafeEqual(Buffer.from(this.sign(value), 'hex'), Buffer.from(signature, 'hex'));
  }
}

export function quoteHash(value: unknown): string {
  return createHash('sha256').update(canonicalQuote(value)).digest('hex');
}

export function canonicalQuote(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalQuote).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalQuote(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
