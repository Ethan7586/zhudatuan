import { z } from 'zod';

const MetricSchema = z.object({
  code: z.string().min(1),
  version: z.number().int().nonnegative(),
  scope: z.string().min(1),
  period: z.object({ from: z.string().min(1), to: z.string().min(1), timezone: z.string().min(1) }),
  dimensions: z.record(z.string(), z.string()),
  value: z.number().finite(),
  unit: z.enum(['minor', 'count', 'ratio']),
  watermark: z.string().min(1),
  projectionVersion: z.number().int().nonnegative(),
});

const SalesSchema = z.object({
  asOf: z.string().min(1),
  cumulativeSalesCents: z.number().finite(),
  paidOrderCount: z.number().finite(),
  averageOrderValueCents: z.number().finite(),
  periodSalesCents: z.number().finite(),
  periodPaidOrderCount: z.number().finite(),
  refundedCents: z.number().finite(),
  activeProductCount: z.number().finite(),
  soldProductCount: z.number().finite(),
  unsoldActiveProductCount: z.number().finite(),
  trend: z.array(z.object({ date: z.string().min(1), salesCents: z.number().finite(), orderCount: z.number().finite() })),
  weeklyTrend: z.array(z.object({ date: z.string().min(1), salesCents: z.number().finite(), orderCount: z.number().finite() })).optional(),
  categories: z.array(z.object({ name: z.string().min(1), salesCents: z.number().finite(), share: z.number().finite() })),
  topProducts: z.array(z.unknown()),
  period: z.object({ from: z.string().min(1), to: z.string().min(1) }).optional(),
  conclusion: z.string().min(1).optional(),
  deltas: z.object({
    netSalesRatio: z.number().finite().optional(),
    paidOrdersRatio: z.number().finite().optional(),
    averageOrderRatio: z.number().finite().optional(),
    refundRate: z.number().finite().optional(),
    refundRateDeltaPoints: z.number().finite().optional(),
  }).optional(),
  malls: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    salesCents: z.number().finite(),
    paidOrderCount: z.number().int().nonnegative(),
    refundRate: z.number().finite(),
  })).optional(),
  events: z.array(z.object({
    id: z.string().min(1),
    kind: z.enum(['calendar', 'warning', 'sync']),
    title: z.string().min(1),
    metric: z.string().min(1),
    time: z.string().min(1),
    date: z.string().min(1).optional(),
  })).optional(),
  insights: z.array(z.object({
    id: z.string().min(1),
    tone: z.enum(['warning', 'positive']),
    title: z.string().min(1),
    detail: z.string().min(1).optional(),
    action: z.string().min(1),
    target: z.enum(['orders', 'reports']).optional(),
  })).optional(),
});

export const CockpitSchema = z.object({
  items: z.array(MetricSchema),
  count: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).optional(),
  summary: z.object({
    catalogCount: z.number().finite(),
    availableStock: z.number().finite(),
    orderCount: z.number().finite(),
    afterSaleCount: z.number().finite(),
    sales: SalesSchema,
  }),
});

export type CockpitData = z.infer<typeof CockpitSchema>;
export type Trend = CockpitData['summary']['sales']['trend'][number];
export type CockpitSales = CockpitData['summary']['sales'];
export type MallPerformance = NonNullable<CockpitSales['malls']>[number];
export type BusinessEvent = NonNullable<CockpitSales['events']>[number];
export type BusinessInsight = NonNullable<CockpitSales['insights']>[number];
