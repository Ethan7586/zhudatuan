import { describe, expect, it } from 'vitest';
import type { FrontendOrder } from '../../adapters/frontendData';
import { matchesMobileOrderFilter, normalizeMobileOrderFilter } from './mobileOrderFilters';

describe('mobile order filters', () => {
  it('opens unknown filters as all orders', () => {
    expect(normalizeMobileOrderFilter(undefined)).toBe('all');
    expect(normalizeMobileOrderFilter('unknown')).toBe('all');
    expect(normalizeMobileOrderFilter('after_sale')).toBe('after_sale');
  });

  it.each([
    ['pending_payment', 'pending_payment', true],
    ['pending_pay', 'pending_payment', true],
    ['pending_shipment', 'pending_shipment', true],
    ['pending_receipt', 'pending_shipment', true],
    ['paid', 'pending_shipment', true],
    ['shipping', 'pending_shipment', true],
    ['shipped', 'pending_shipment', true],
    ['completed', 'completed', true],
    ['after_sale', 'after_sale', true],
    ['completed', 'pending_shipment', false],
  ] as const)('matches %s against %s', (status, filter, expected) => {
    expect(matchesMobileOrderFilter(status as FrontendOrder['status'], filter)).toBe(expected);
  });
});
