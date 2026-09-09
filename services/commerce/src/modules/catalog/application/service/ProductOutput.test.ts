import { describe, expect, it } from 'vitest';
import { productOutput } from './ProductOutput';

describe('productOutput', () => {
  it('keeps public product attributes without exposing the private object reference', () => {
    expect(productOutput({ id: 'product:one', attributes: { coverObject: 'object:cover', subtitle: '节日限定' } })).toEqual({ id: 'product:one', attributes: { subtitle: '节日限定' } });
  });
});
