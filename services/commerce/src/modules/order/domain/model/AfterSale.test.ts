import { describe, expect, it } from 'vitest';
import { AfterSale } from './AfterSale';

describe('AfterSale', () => {
  it('accepts the complete physical return lifecycle', () => {
    expect(AfterSale.from('applied').transition('reviewing')).toBe('reviewing');
    expect(AfterSale.from('reviewing').transition('approved')).toBe('approved');
    expect(AfterSale.from('approved').transition('returning')).toBe('returning');
    expect(AfterSale.from('returning').transition('received')).toBe('received');
    expect(AfterSale.from('received').transition('refunding')).toBe('refunding');
    expect(AfterSale.from('refunding').transition('resolved')).toBe('resolved');
  });

  it('accepts the no-return and review rejection branches', () => {
    expect(AfterSale.from('approved').transition('refunding')).toBe('refunding');
    expect(AfterSale.from('reviewing').transition('rejected')).toBe('rejected');
  });

  it('rejects skipped, reversed and terminal transitions', () => {
    expect(() => AfterSale.from('reviewing').transition('refunding')).toThrow('ORDER_AFTERSALE_NOT_ALLOWED');
    expect(() => AfterSale.from('resolved').transition('reviewing')).toThrow('ORDER_AFTERSALE_NOT_ALLOWED');
    expect(() => AfterSale.from('rejected').transition('approved')).toThrow('ORDER_AFTERSALE_NOT_ALLOWED');
  });
});
