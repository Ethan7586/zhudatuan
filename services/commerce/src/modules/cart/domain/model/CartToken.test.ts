import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CartToken } from './CartToken';

describe('CartToken', () => {
  it('keeps only a one-way digest of an exact 256-bit URL-safe bearer', () => {
    const raw = 'a'.repeat(43);
    const token = CartToken.required(raw);
    expect(token.digest).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(JSON.stringify(token)).not.toContain(raw);
  });

  it.each(['short', 'a'.repeat(42), `${'a'.repeat(42)}+`])('rejects malformed token %s', (raw) => {
    expect(() => CartToken.required(raw)).toThrow();
  });
});
