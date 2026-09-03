import { z } from 'zod';

const metric = z.object({ code: z.string().min(1), version: z.number().int().nonnegative(), scope: z.string().min(1), period: z.object({ from: z.string().min(1), to: z.string().min(1), timezone: z.string().min(1) }).strict(), dimensions: z.record(z.string(), z.string()), value: z.number().finite(), unit: z.enum(['minor', 'count', 'ratio']), watermark: z.string().min(1), projectionVersion: z.number().int().nonnegative() }).strict();
const trend = z.object({ date: z.string().min(1), salesCents: z.number().finite(), orderCount: z.number().finite() }).strict();
const category = z.object({ name: z.string().min(1), salesCents: z.number().finite(), share: z.number().finite() }).strict();
const nullableNumber = z.number().finite().nullable();
const sales = z.object({
  asOf: z.string().datetime(), cumulativeSalesCents: z.number().finite(), paidOrderCount: z.number().finite(), averageOrderValueCents: z.number().finite(), periodSalesCents: z.number().finite(), periodPaidOrderCount: z.number().finite(), refundedCents: z.number().finite(), activeProductCount: z.number().finite(), soldProductCount: z.number().finite(), unsoldActiveProductCount: z.number().finite(),
  period: z.object({ from: z.string().datetime(), to: z.string().datetime() }).strict(),
  conclusion: z.string().min(1),
  deltas: z.object({ netSalesRatio: nullableNumber, paidOrdersRatio: nullableNumber, averageOrderRatio: nullableNumber, refundRate: z.number().finite(), refundRateDeltaPoints: nullableNumber }).strict(),
  trend: z.array(trend), weeklyTrend: z.array(trend), categories: z.array(category), topProducts: z.array(z.unknown()),
  malls: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), salesCents: z.number().finite(), paidOrderCount: z.number().int().nonnegative(), refundRate: z.number().finite() }).strict()),
  events: z.array(z.object({ id: z.string().min(1), kind: z.enum(['calendar', 'warning', 'sync']), title: z.string().min(1), metric: z.string().min(1), time: z.string().datetime(), date: z.string().min(1) }).strict()),
  insights: z.array(z.object({ id: z.string().min(1), tone: z.enum(['warning', 'positive']), title: z.string().min(1), detail: z.string(), action: z.string().min(1), target: z.enum(['orders', 'reports']) }).strict()),
}).strict();
export const CockpitSchema = z.object({ items: z.array(metric), count: z.number().int().nonnegative(), nextCursor: z.string().min(1).optional(), summary: z.object({ catalogCount: z.number().finite(), availableStock: z.number().finite(), orderCount: z.number().finite(), afterSaleCount: z.number().finite(), sales }).strict() }).strict();
