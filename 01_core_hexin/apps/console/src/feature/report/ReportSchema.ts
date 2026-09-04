import { z } from 'zod';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

export const ReportMetricSchema = z.object({
  code: z.string().min(1), version: z.number().int().nonnegative(), scope: z.string().min(1),
  period: z.object({ from: z.string().min(1), to: z.string().min(1), timezone: z.string().min(1) }),
  dimensions: z.record(z.string(), z.string()), value: z.number().finite(), unit: z.enum(['minor', 'count', 'ratio']),
  watermark: z.string().min(1), projectionVersion: z.number().int().nonnegative(),
}).passthrough();
export const ReportPageSchema = pageEnvelope(ReportMetricSchema);
export type ReportMetric = z.infer<typeof ReportMetricSchema>;
export type ReportView = 'sales' | 'products' | 'malls' | 'categories' | 'channels' | 'powderclass' | 'voucher';
export type ReportPeriod = 'realtime' | 'yesterday' | '7days' | '30days';
