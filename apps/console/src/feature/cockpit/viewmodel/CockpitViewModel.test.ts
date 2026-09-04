import { describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { CockpitMapper } from '../infrastructure/CockpitMapper';
import { cockpitKey } from './CockpitQueryKey';

describe('CockpitViewModel boundaries', () => {
  it('isolates cache identity by scope, access version, period and application', () => {
    const context = { scope: { kind: 'mall', id: 'mall:one' }, session: { accessVersion: 9 } } as ConsoleContext;
    const realtime = cockpitKey(context, { period: 'realtime' });
    const application = cockpitKey(context, { period: 'realtime', application: 'application:one' });
    expect(realtime.slice(0, 4)).toEqual(['console', 'mall', 'mall:one', 9]);
    expect(realtime).not.toEqual(application);
  });

  it('rejects DTO extensions and preserves the complete cockpit projection', () => {
    const value = {
      items: [],
      count: 0,
      summary: {
        catalogCount: 0,
        availableStock: 0,
        orderCount: 0,
        afterSaleCount: 0,
        sales: {
          asOf: '2026-09-03T00:00:00Z',
          cumulativeSalesCents: 0,
          paidOrderCount: 0,
          averageOrderValueCents: 0,
          periodSalesCents: 0,
          periodPaidOrderCount: 0,
          refundedCents: 0,
          activeProductCount: 0,
          soldProductCount: 0,
          unsoldActiveProductCount: 0,
          period: { from: '2026-09-01T00:00:00Z', to: '2026-09-03T00:00:00Z' },
          conclusion: '经营稳定',
          deltas: { netSalesRatio: null, paidOrdersRatio: null, averageOrderRatio: null, refundRate: 0, refundRateDeltaPoints: null },
          trend: [],
          weeklyTrend: [],
          categories: [],
          topProducts: [{ productId: 'product:one', name: '办公套装', salesCents: 12800, quantity: 2, orderCount: 1 }],
          malls: [],
          events: [],
          insights: [],
        },
      },
    };
    const mapper = new CockpitMapper();
    expect(mapper.map(value).summary.sales.topProducts).toEqual([{ productId: 'product:one', name: '办公套装', salesCents: 12800, quantity: 2, orderCount: 1 }]);
    expect(() => mapper.map({ ...value, unexpected: true })).toThrow();
  });
});
