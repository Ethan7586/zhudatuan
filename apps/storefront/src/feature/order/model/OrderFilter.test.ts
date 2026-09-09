import { describe, expect, it } from 'vitest';
import { orderFilter } from './OrderFilter';

describe('orderFilter', () => {
  it('accepts only the six real order views', () => {
    expect(orderFilter('pending_shipment')).toBe('pending_shipment');
    expect(orderFilter('after_sale')).toBe('after_sale');
    expect(orderFilter('shipping')).toBe('all');
    expect(orderFilter(null)).toBe('all');
  });
});
