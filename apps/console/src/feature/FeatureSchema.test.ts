import { queryCondition } from '@shop/presentation';
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ApiError } from '@shop/sdk';
import { operationSchema } from '@shop/contract';
import { CockpitSchema } from './cockpit/infrastructure/CockpitSchema';
import { DistributionPageSchema, PlatformPageSchema } from './control/infrastructure/ControlSchema';
import { FinanceOverviewSchema } from './finance/infrastructure/OverviewSchema';
import { EMPTY_ORDER_LIST_FILTER } from './order/model/OrderFilter';
import { OrderPageSchema } from './order/infrastructure/OrderSchema';
import { orderKey } from './order/viewmodel/OrderQueryKey';
import { productKey } from './product/viewmodel/ProductQueryKey';
import type { ConsoleContext } from '../entity/session/ConsoleSession';

describe('Console feature-owned response schemas', () => {
  it('parses product and order responses only through their contract schemas', () => {
    const products = operationSchema('catalog.listings.read').output.parse({
      count: 1,
      items: [
        {
          id: 'listing:1',
          scope_id: 'mall:1',
          sku_id: 'sku:1',
          product_id: 'product:1',
          title: '核心商品',
          status: 'published',
          version: 3,
          pool_id: null,
          product_type: 'physical',
          subtitle: null,
          cover_url: null,
          effective_at: null,
          expires_at: null,
          cursor_sort: '2026-08-26T00:00:00.000Z',
          code: 'SKU-1',
          category_id: 'category:1',
          category_name: '办公用品',
          source: 'self',
          source_partner_id: null,
          source_partner_name: null,
          pool_name: null,
          sku_count: 1,
          sku_total: 2,
          mall_count: 1,
          mall_total: 3,
          price_amount_minor: 31500,
          price_currency: 'CNY',
          price_version: 3,
          saleable_stock: 8,
          qualification_eligible: true,
          data_gaps: [],
        },
      ],
    });
    const orders = OrderPageSchema.parse({
      count: 1,
      items: [
        {
          id: 'order:1',
          order_number: 'SW1',
          scope_id: 'enterprise:1',
          member_id: 'member:1',
          mall_id: 'mall:1',
          checkout_id: 'checkout:1',
          total_minor: 31500,
          currency: 'CNY',
          payment_state: 'paid',
          fulfillment_state: 'allocated',
          aftersale_state: 'none',
          lifecycle_state: 'paid',
          address: null,
          payment: { paymentId: 'payment:1', version: 0, capturedMinor: 31500, refundedMinor: 0, refundableMinor: 31500, updatedAt: '2026-08-26T00:00:00Z', tenders: [] },
          fulfillments: [],
          refunds: [],
          timeline: [],
          receivedAt: null,
          created_at: '2026-08-26T00:00:00Z',
          updated_at: '2026-08-26T00:00:00Z',
          version: 2,
          lines: [],
        },
      ],
      facets: {
        state: 'ready',
        data: {
          counts: { all: 1, unpaid: 0, unshipped: 1, active: 0, completed: 0, aftersale: 0, exception: 0 },
          watermarks: { order: '2026-08-26T00:00:00Z', payment: '2026-08-26T00:00:00Z', fulfillment: null, aftersale: null, refund: null },
        },
      },
    });
    expect(products.items[0]?.version).toBe(3);
    expect(orders.items[0]?.total_minor).toBe(31500);
    expect(() => OrderPageSchema.parse({ count: 1, items: [{ ...orders.items[0], total_minor: '31500' }], facets: orders.facets })).toThrow();
  });

  it('rejects partial dashboard, control and finance payloads', () => {
    expect(() => CockpitSchema.parse({ items: [], count: 0 })).toThrow();
    expect(() => PlatformPageSchema.parse({ items: [{ id: 'platform:1' }], count: 1 })).toThrow();
    expect(() => DistributionPageSchema.parse({ items: [{ id: 'distributor:1' }], count: 1 })).toThrow();
    expect(() => FinanceOverviewSchema.parse({ items: [{ currency: 'CNY' }] })).toThrow();
  });

  it('isolates every server page by explicit scope, access version and URL filter', () => {
    const first = context('mall:1', 3);
    const second = context('mall:2', 4);
    const filter = { q: '', category: '', supplier: '', mall: '', status: '', limit: 50, cursor: 'cursor:1' } as const;
    expect(productKey(first, filter)).not.toEqual(productKey(second, filter));
    expect(orderKey(first, { ...EMPTY_ORDER_LIST_FILTER, search: 'SW1', view: 'all' })).toContain('order.orders.read');
  });

  it('preserves prior data only for transient failures, never for access denial', () => {
    const state = { pending: false, fetching: false, hasData: true, empty: false };
    expect(queryCondition({ ...state, error: new Error('NETWORK_FAILURE') })).toBe('stale');
    expect(queryCondition({ ...state, error: new ApiError('PERMISSION_DENIED', 403, 'request:1') })).toBe('forbidden');
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
