import { describe, expect, it } from 'vitest';
import { OrderReadFilter } from './OrderReadFilter';

describe('OrderReadFilter', () => {
  it('normalizes an empty query to the authoritative unfiltered view', () => {
    expect(OrderReadFilter.from({ query: {} })).toEqual({ order: '', view: 'all', placed: '', lifecycle: '', payment: '', fulfillment: '', mall: '' });
  });

  it('accepts the bounded contract values and the first transport value', () => {
    expect(
      OrderReadFilter.from({
        query: {
          order: [' order:one ', 'order:ignored'],
          view: 'unshipped',
          placed: '7days',
          lifecycle: 'paid',
          payment: 'partially_refunded',
          fulfillment: 'allocated',
          mall: ' mall:one ',
        },
      })
    ).toEqual({ order: 'order:one', view: 'unshipped', placed: '7days', lifecycle: 'paid', payment: 'partially_refunded', fulfillment: 'allocated', mall: 'mall:one' });
  });

  it.each([
    ['view', 'deleted'],
    ['placed', 'forever'],
    ['lifecycle', 'unknown'],
    ['payment', 'unknown'],
    ['fulfillment', 'unknown'],
    ['order', 'x'.repeat(256)],
    ['mall', 'x'.repeat(256)],
  ])('rejects an invalid %s value', (key, value) => {
    expect(() => OrderReadFilter.from({ query: { [key]: value } })).toThrow();
  });
});
