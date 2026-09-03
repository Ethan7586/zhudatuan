import { z } from 'zod';
import { pageEnvelope } from '../../../shared/schema/PageEnvelope';

export const ReportMetricSchema = z
  .object({
    code: z.string().min(1),
    version: z.number().int().nonnegative(),
    scope: z.string().min(1),
    period: z.object({ from: z.string().min(1), to: z.string().min(1), timezone: z.string().min(1) }),
    dimensions: z.record(z.string(), z.string()),
    value: z.number().finite(),
    unit: z.enum(['minor', 'count', 'ratio']),
    watermark: z.string().min(1),
    projectionVersion: z.number().int().nonnegative(),
  })
  .strict();
export const ReportPageSchema = pageEnvelope(ReportMetricSchema);
export const ReportExportSchema = z.object({
  id: z.string().min(1), scope: z.string().min(1), report: z.enum(['metrics', 'orders', 'finance.statement']), filter: z.record(z.string(), z.unknown()),
  state: z.enum(['queued', 'running', 'completed', 'failed', 'expired']), cursor: z.string().nullable(), recordCount: z.number().int().nonnegative(),
  objectReference: z.string().nullable(), objectHash: z.string().nullable(), objectSize: z.number().int().nonnegative().nullable(),
  scanState: z.enum(['pending', 'clean', 'rejected']).nullable(), expiresAt: z.string().nullable(), createdAt: z.string().min(1), generatedAt: z.string().nullable(),
  download: z.object({ url: z.string().url().refine((value) => new URL(value).protocol === 'https:', '下载地址必须使用 HTTPS。'), expiresAt: z.string().min(1) }).strict().optional(),
}).strict();
