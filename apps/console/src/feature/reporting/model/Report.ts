import { REPORT_PERIODS, REPORT_VIEWS, type OperationOutputFor } from '@shop/contract';
import type { DeepReadonly } from '../../../shared/model/Immutable';

export const reportViews = REPORT_VIEWS;
export const reportPeriods = REPORT_PERIODS;

export type ReportView = (typeof reportViews)[number];
export type ReportPeriod = (typeof reportPeriods)[number];

type MetricPage = DeepReadonly<OperationOutputFor<'reporting.products.read'>>;
type SalesPage = DeepReadonly<OperationOutputFor<'reporting.sales.read'>>;
export type ReportMetric = MetricPage['items'][number];
export type ReportSnapshot = MetricPage['snapshot'];
export type DimensionPreset = NonNullable<SalesPage['preset']>;
export type ReportPage = MetricPage & Readonly<{ preset?: DimensionPreset | null }>;

export interface ReportFilter {
  readonly view: ReportView;
  readonly period: ReportPeriod;
  readonly application?: string;
  readonly cursor?: string;
}

export type ReportExport = DeepReadonly<OperationOutputFor<'reporting.exports.read'>>;
