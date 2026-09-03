import type { CockpitData } from '../model/Cockpit';
import { CockpitSchema } from './CockpitSchema';

export class CockpitMapper {
  map(value: unknown): CockpitData {
    const parsed = CockpitSchema.parse(value);
    const sales = parsed.summary.sales;
    return Object.freeze({
      items: Object.freeze(parsed.items.map((item) => Object.freeze({ ...item, period: Object.freeze(item.period), dimensions: Object.freeze({ ...item.dimensions }) }))),
      count: parsed.count,
      ...(parsed.nextCursor ? { nextCursor: parsed.nextCursor } : {}),
      summary: Object.freeze({
        catalogCount: parsed.summary.catalogCount,
        availableStock: parsed.summary.availableStock,
        orderCount: parsed.summary.orderCount,
        afterSaleCount: parsed.summary.afterSaleCount,
        sales: Object.freeze({
          asOf: sales.asOf,
          cumulativeSalesCents: sales.cumulativeSalesCents,
          paidOrderCount: sales.paidOrderCount,
          averageOrderValueCents: sales.averageOrderValueCents,
          periodSalesCents: sales.periodSalesCents,
          periodPaidOrderCount: sales.periodPaidOrderCount,
          refundedCents: sales.refundedCents,
          activeProductCount: sales.activeProductCount,
          soldProductCount: sales.soldProductCount,
          unsoldActiveProductCount: sales.unsoldActiveProductCount,
          period: Object.freeze({ ...sales.period }),
          conclusion: sales.conclusion,
          deltas: Object.freeze({ ...sales.deltas }),
          trend: Object.freeze(sales.trend.map((row) => Object.freeze(row))),
          weeklyTrend: Object.freeze(sales.weeklyTrend.map((row) => Object.freeze(row))),
          categories: Object.freeze(sales.categories.map((row) => Object.freeze(row))),
          malls: Object.freeze(sales.malls.map((row) => Object.freeze(row))),
          events: Object.freeze(sales.events.map((row) => Object.freeze(row))),
          insights: Object.freeze(sales.insights.map((row) => Object.freeze(row))),
        }),
      }),
    });
  }
}
