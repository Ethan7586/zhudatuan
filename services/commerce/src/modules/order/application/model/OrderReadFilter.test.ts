import { describe, expect, it } from 'vitest';
import { OrderReadFilter } from './OrderReadFilter';

describe('OrderReadFilter', () => {
  it('normalizes an empty query to the authoritative unfiltered view', () => {
    expect(OrderReadFilter.from({ query: {} })).toEqual({
      search: '',
      order: '',
      view: 'all',
      placed: '',
      from: '',
      to: '',
      lifecycle: '',
      payment: '',
      fulfillment: '',
      mall: '',
      channel: '',
      product: '',
      member: '',
      minimumMinor: null,
      maximumMinor: null,
    });
  });

  it('accepts the bounded contract values and the first transport value', () => {
    expect(
      OrderReadFilter.from({
        query: {
          search: [' ZD202609050001 ', 'ignored'],
          order: ' order:one ',
          view: 'unshipped',
          placed: '7days',
          lifecycle: 'paid',
          payment: 'partially_refunded',
          fulfillment: 'allocated',
          mall: ' mall:one ',
          channel: ' jdproduct ',
          product: ' 福利礼盒 ',
          member: ' 张三 ',
          minimumMinor: '100',
          maximumMinor: '10000',
        },
      })
    ).toEqual({
      search: 'ZD202609050001',
      order: 'order:one',
      view: 'unshipped',
      placed: '7days',
      from: '',
      to: '',
      lifecycle: 'paid',
      payment: 'partially_refunded',
      fulfillment: 'allocated',
      mall: 'mall:one',
      channel: 'jdproduct',
      product: '福利礼盒',
      member: '张三',
      minimumMinor: 100,
      maximumMinor: 10000,
    });
  });

  it('uses the same normalization for export bodies and removes inactive values from the frozen snapshot', () => {
    const filter = OrderReadFilter.from({ body: { search: ' 外部-001 ', payment: 'paid', minimumMinor: 0 } });
    expect(filter.snapshot()).toEqual({ search: '外部-001', payment: 'paid', minimumMinor: 0 });
  });

  it.each([
    ['view', 'deleted'],
    ['placed', 'forever'],
    ['lifecycle', 'unknown'],
    ['payment', 'unknown'],
    ['fulfillment', 'unknown'],
    ['search', 'x'.repeat(129)],
    ['mall', 'x'.repeat(256)],
  ])('rejects an invalid %s value', (key, value) => {
    expect(() => OrderReadFilter.from({ query: { [key]: value } })).toThrow();
  });
});
