// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ApiError } from '@shop/sdk';
import { CockpitSchema } from './cockpit/CockpitSchema';
import { DistributorPageSchema, LayerPageSchema } from './control/ControlSchema';
import { FinanceOverviewSchema } from './finance/FinanceSchema';
import { OrderPageSchema } from './order/OrderSchema';
import { orderKey } from './order/OrderQuery';
import { ListingPageSchema } from './product/ProductSchema';
import { productKey } from './product/ProductQuery';
import type { ConsoleContext } from '../entity/session/ConsoleSession';
import { queryCondition } from '../shared/api/QueryState';

describe('Console feature-owned response schemas', () => {
  it('normalizes database bigint strings only when safe', () => {
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
          lifecycle_state: 'paid',
          created_at: '2026-08-26T00:00:00Z',
          updated_at: '2026-08-26T00:00:00Z',
          version: '2',
        },
      ],
    });
    expect(products.items[0]?.version).toBe(3);
    expect(orders.items[0]?.total_minor).toBe(31500);
    expect(() => OrderPageSchema.parse({ count: 1, items: [{ ...orders.items[0], total_minor: '999999999999999999999' }] })).toThrow();
  });

  it('rejects partial dashboard, control and finance payloads', () => {
    expect(() => CockpitSchema.parse({ items: [], count: 0 })).toThrow();
    expect(() => LayerPageSchema.parse({ items: [{ id: 'platform:1' }], count: 1 })).toThrow();
    expect(() => DistributorPageSchema.parse({ items: [{ id: 'distributor:1' }], count: 1 })).toThrow();
    expect(() => FinanceOverviewSchema.parse({ items: [{ currency: 'CNY' }] })).toThrow();
  });

  it('isolates every server page by explicit scope, access version and URL filter', () => {
    const first = context('mall:1', 3);
    const second = context('mall:2', 4);
    expect(productKey(first, { cursor: 'cursor:1' })).not.toEqual(productKey(second, { cursor: 'cursor:1' }));
    expect(orderKey(first, { order: 'SW1' })).toContain('order.orders.read');
  });

  it('preserves prior data only for transient failures, never for access denial', () => {
    const state = { pending: false, fetching: false, hasData: true, empty: false };
    expect(queryCondition({ ...state, error: new Error('NETWORK_FAILURE') })).toBe('stale');
    expect(queryCondition({ ...state, error: new ApiError('PERMISSION_DENIED', 403, 'request:1') })).toBe('denied');
    expect(queryCondition({ ...state, fetching: true, error: new Error('NETWORK_FAILURE') })).toBe('retry');
  });
});

function context(id: string, accessVersion: number): ConsoleContext {
  const scope = { kind: 'mall' as const, id };
  return {
    session: {
      actor: 'actor:1',
      membership: 'membership:1',
      accessVersion,
      permissions: [],
      capabilities: [],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level: 1 },
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
      syncedAt: '2026-08-26T00:00:00Z',
    },
    profile: { display_name: '测试运营', employee_no: null },
    scope,
    scopes: [scope],
  };
}
