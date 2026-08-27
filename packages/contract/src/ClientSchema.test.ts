import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseClientPage, transportInteger } from './ClientSchema';

describe('client response schemas', () => {
  const item = z.object({ id: z.string() });

  it('parses the canonical cursor envelope', () => {
    expect(parseClientPage({ items: [{ id: 'one' }], nextCursor: 'next' }, item)).toEqual({
      items: [{ id: 'one' }],
      nextCursor: 'next',
    });
  });

  it('fails closed for noncanonical arrays, single items and invalid rows', () => {
    expect(() => parseClientPage([{ id: 'one' }], item)).toThrow();
    expect(() => parseClientPage({ id: 'one' }, item)).toThrow();
    expect(() => parseClientPage({ items: [{ id: 1 }] }, item)).toThrow();
  });

  it('accepts safe transport integers and rejects unsafe values', () => {
    expect(transportInteger.parse('42')).toBe(42);
    expect(transportInteger.parse(-7)).toBe(-7);
    expect(() => transportInteger.parse('4.2')).toThrow();
    expect(() => transportInteger.parse(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});
