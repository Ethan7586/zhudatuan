import { array, literal, null as nullSchema, number, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const jsonObject = record(string(), ContractJsonValueSchema);
const reportQuery = strictObject({ ...pageQuery, period: optional(literal(['realtime', 'yesterday', '7days', '30days'])), applicationid: optional(string()) });
const metric = strictObject({
  code: string(),
  version,
  scope: string(),
  period: strictObject({ from: isoUtc, to: isoUtc, timezone: string() }),
  dimensions: record(string(), string()),
  value: number(),
  unit: literal(['minor', 'count', 'ratio']),
  watermark: isoUtc,
  projectionVersion: version,
});
const metricPage = pageOutput(metric);
const summary = strictObject({
  catalogCount: unsigned,
  availableStock: number(),
  orderCount: unsigned,
  afterSaleCount: unsigned,
  sales: strictObject({
    asOf: isoUtc,
    cumulativeSalesCents: number(),
    paidOrderCount: number(),
    averageOrderValueCents: number(),
    periodSalesCents: number(),
    periodPaidOrderCount: number(),
    refundedCents: number(),
    activeProductCount: unsigned,
    soldProductCount: unsigned,
    unsoldActiveProductCount: unsigned,
    trend: array(strictObject({ date: string(), salesCents: number(), orderCount: number() })),
    categories: array(strictObject({ name: string(), salesCents: number(), share: number() })),
    topProducts: array(ContractJsonValueSchema),
  }),
});
const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);
const job = strictObject({
  id: string(),
  scope: string(),
  report: literal(['metrics', 'orders', 'finance.statement']),
  filter: jsonObject,
  state: literal(['queued', 'running', 'completed', 'failed', 'expired']),
  cursor: nullableText,
  recordCount: unsigned,
  objectReference: nullableText,
  objectHash: nullableText,
  objectSize: union([unsigned, nullSchema()]),
  scanState: union([literal(['pending', 'clean', 'rejected']), nullSchema()]),
  expiresAt: nullableTime,
  createdAt: isoUtc,
  generatedAt: nullableTime,
  download: optional(strictObject({ url: string(), expiresAt: isoUtc })),
});

export const REPORTING_BODY_SCHEMAS = {
  ReportingExportsCreateInput: strictObject({ report: literal(['metrics', 'orders', 'finance.statement']), filter: optional(jsonObject) }),
} as const;

export const REPORTING_QUERY_SCHEMAS = {
  ReportingDashboardReadInput: reportQuery,
  ReportingSalesReadInput: reportQuery,
  ReportingProductsReadInput: reportQuery,
  ReportingMallsReadInput: reportQuery,
  ReportingCategoriesReadInput: reportQuery,
  ReportingChannelsReadInput: reportQuery,
  ReportingPowderclassReadInput: reportQuery,
  ReportingVoucherconsumptionReadInput: reportQuery,
  ReportingExportsReadInput: strictObject({}),
} as const;

export const REPORTING_OUTPUT_SCHEMAS = {
  ReportingDashboardReadOutput: strictObject({ ...metricPage.shape, summary }),
  ReportingSalesReadOutput: metricPage,
  ReportingProductsReadOutput: metricPage,
  ReportingMallsReadOutput: metricPage,
  ReportingCategoriesReadOutput: metricPage,
  ReportingChannelsReadOutput: metricPage,
  ReportingPowderclassReadOutput: metricPage,
  ReportingVoucherconsumptionReadOutput: metricPage,
  ReportingExportsCreateOutput: job,
  ReportingExportsReadOutput: job,
} as const;
