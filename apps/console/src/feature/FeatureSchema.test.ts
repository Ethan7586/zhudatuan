// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ApiError } from '@shop/sdk';
import { CockpitSchema } from './cockpit/CockpitSchema';
import { ControlSchema } from './control/ControlSchema';
import { FinanceOverviewSchema } from './finance/FinanceSchema';
import { OrderPageSchema } from './order/OrderSchema';
import { orderKey } from './order/OrderQuery';
import { ListingPageSchema } from './product/ProductSchema';
import { productKey } from './product/ProductQuery';
import type { ConsoleContext } from '../entity/session/ConsoleSession';
import { queryCondition } from '../shared/api/QueryState';

describe('Console feature-owned response schemas', () => {
  it('normalizes database bigint strings only when safe', () => {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const products = ListingPageSchema.parse({
      count: 1,
      items: [
        {
          id: 'listing:1',
          sku_id: 'sku:1',
          product_id: 'product:1',
          title: '核心商品',
          status: 'published',
          version: '3',
        },
      ],
    });
    const orders = OrderPageSchema.parse({
      count: 1,
      items: [
        {
          id: 'order:1',
          order_number: 'SW1',
          total_minor: '31500',
          currency: 'CNY',
          payment_state: 'paid',
          fulfillment_state: 'allocated',
          aftersale_state: 'none',
          lifecycle_state: 'active',
          created_at: '2026-08-26T00:00:00Z',
          updated_at: '2026-08-26T00:00:00Z',
          version: '2',
        },
      ],
    });
<<<<<<< HEAD
    expect(products.items[0]?.version).toBe(3);
    expect(orders.items[0]?.total_minor).toBe(31500);
    const overview = FinanceOverviewSchema.parse({ items: [{ currency: 'CNY', balance_minor: '-125', liability_minor: '25', income_minor: '100', expense_minor: '10', cash_minor: '75', journal_count: 2, watermark: null }] });
    expect(overview.items[0]?.balance_minor).toBe(-125);
    expect(() => OrderPageSchema.parse({ count: 1, items: [{ ...orders.items[0], total_minor: '999999999999999999999' }] })).toThrow();
    expect(() => FinanceOverviewSchema.parse({ items: [{ ...overview.items[0], balance_minor: '999999999999999999999' }] })).toThrow();
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    const products = ListingPageSchema.parse({ count: 1, items: [{
      id: 'listing:1', sku_id: 'sku:1', product_id: 'product:1', title: '核心商品', status: 'published', version: '3',
    }] });
    const orders = OrderPageSchema.parse({ count: 1, items: [{ id: 'order:1', order_number: 'SW1', total_minor: '31500', currency: 'CNY',
      payment_state: 'paid', fulfillment_state: 'allocated', aftersale_state: 'none', lifecycle_state: 'active',
      created_at: '2026-08-26T00:00:00Z', updated_at: '2026-08-26T00:00:00Z', version: '2' }] });
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    expect(products.items[0]?.version).toBe(3);
    expect(orders.items[0]?.total_minor).toBe(31500);
    const overview = FinanceOverviewSchema.parse({ items: [{ currency: 'CNY', balance_minor: '-125', liability_minor: '25', income_minor: '100', expense_minor: '10', cash_minor: '75', journal_count: 2, watermark: null }] });
    expect(overview.items[0]?.balance_minor).toBe(-125);
    expect(() => OrderPageSchema.parse({ count: 1, items: [{ ...orders.items[0], total_minor: '999999999999999999999' }] })).toThrow();
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    expect(() => FinanceOverviewSchema.parse({ items: [{ ...overview.items[0], balance_minor: '999999999999999999999' }] })).toThrow();
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    expect(products.items[0]?.version).toBe(3);
    expect(orders.items[0]?.total_minor).toBe(31500);
    expect(() => OrderPageSchema.parse({ count: 1, items: [{ ...orders.items[0], total_minor: '999999999999999999999' }] })).toThrow();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  });

  it('rejects partial dashboard, control and finance payloads', () => {
    expect(() => CockpitSchema.parse({ items: [], count: 0 })).toThrow();
    expect(() => ControlSchema.parse({ status: 'available', queue: {} })).toThrow();
    expect(() => FinanceOverviewSchema.parse({ items: [{ currency: 'CNY' }] })).toThrow();
  });

  it('isolates every server page by explicit scope, access version and URL filter', () => {
    const first = context('mall:1', 3);
    const second = context('mall:2', 4);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    expect(productKey(first, { q: '牛奶', category: '', cursor: 'cursor:1' })).not.toEqual(productKey(second, { q: '牛奶', category: '', cursor: 'cursor:1' }));
=======
    expect(productKey(first, { q: '牛奶', category: '', cursor: 'cursor:1' }))
      .not.toEqual(productKey(second, { q: '牛奶', category: '', cursor: 'cursor:1' }));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    expect(productKey(first, { q: '牛奶', category: '', cursor: 'cursor:1' })).not.toEqual(productKey(second, { q: '牛奶', category: '', cursor: 'cursor:1' }));
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    expect(productKey(first, { q: '牛奶', category: '', cursor: 'cursor:1' }))
      .not.toEqual(productKey(second, { q: '牛奶', category: '', cursor: 'cursor:1' }));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    expect(orderKey(first, { order: 'SW1' })).toContain('order.orders.read');
  });

  it('preserves prior data only for transient failures, never for access denial', () => {
    const state = { pending: false, fetching: false, hasData: true, empty: false, stale: false };
    expect(queryCondition({ ...state, error: new Error('NETWORK_FAILURE') })).toBe('stale');
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    expect(queryCondition({ ...state, error: new ApiError('SESSION_EXPIRED', 401, 'request:0') })).toBe('unauthenticated');
    expect(queryCondition({ ...state, error: new ApiError('PERMISSION_DENIED', 403, 'request:1') })).toBe('denied');
    expect(queryCondition({ ...state, fetching: true, error: new ApiError('PERMISSION_DENIED', 403, 'request:2') })).toBe('denied');
=======
    expect(queryCondition({ ...state, error: new ApiError('PERMISSION_DENIED', 403, 'request:1') })).toBe('denied');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    expect(queryCondition({ ...state, error: new ApiError('SESSION_EXPIRED', 401, 'request:0') })).toBe('unauthenticated');
    expect(queryCondition({ ...state, error: new ApiError('PERMISSION_DENIED', 403, 'request:1') })).toBe('denied');
    expect(queryCondition({ ...state, fetching: true, error: new ApiError('PERMISSION_DENIED', 403, 'request:2') })).toBe('denied');
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    expect(queryCondition({ ...state, error: new ApiError('PERMISSION_DENIED', 403, 'request:1') })).toBe('denied');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    expect(queryCondition({ ...state, fetching: true, error: new Error('NETWORK_FAILURE') })).toBe('retry');
  });
});

function context(id: string, accessVersion: number): ConsoleContext {
  const scope = { kind: 'mall' as const, id };
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  return {
    session: { actor: 'actor:1', membership: 'membership:1', accessVersion, permissions: [], capabilities: [], target: 'console', scope, scopes: [scope], assurance: { level: 1 }, syncedAt: '2026-08-26T00:00:00Z' },
    profile: { display_name: '测试运营', employee_no: null },
    scope,
    scopes: [scope],
  };
<<<<<<< HEAD
=======
  return { session: { actor: 'actor:1', membership: 'membership:1', accessVersion, permissions: [], capabilities: [], target: 'console',
    scope, scopes: [scope], assurance: { level: 1 }, syncedAt: '2026-08-26T00:00:00Z' },
  profile: { display_name: '测试运营', employee_no: null }, scope, scopes: [scope] };
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  return { session: { actor: 'actor:1', membership: 'membership:1', accessVersion, permissions: [], capabilities: [], target: 'console',
    scope, scopes: [scope], assurance: { level: 1 }, syncedAt: '2026-08-26T00:00:00Z' },
  profile: { display_name: '测试运营', employee_no: null }, scope, scopes: [scope] };
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}
