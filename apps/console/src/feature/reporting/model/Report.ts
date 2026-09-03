export const reportViews = ['sales', 'products', 'malls', 'categories', 'channels', 'voucher'] as const;
export const reportPeriods = ['realtime', 'yesterday', '7days', '30days'] as const;

export type ReportView = (typeof reportViews)[number];
export type ReportPeriod = (typeof reportPeriods)[number];

export interface ReportMetric {
  readonly code: string;
  readonly version: number;
  readonly scope: string;
  readonly period: Readonly<{ from: string; to: string; timezone: string }>;
  readonly dimensions: Readonly<Record<string, string>>;
  readonly value: number;
  readonly unit: 'minor' | 'count' | 'ratio';
  readonly watermark: string;
  readonly projectionVersion: number;
}

export interface ReportPage {
  readonly items: readonly ReportMetric[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface ReportFilter {
  readonly view: ReportView;
  readonly period: ReportPeriod;
  readonly application?: string;
  readonly cursor?: string;
}

export interface ReportExport {
  readonly id: string;
  readonly scope: string;
  readonly report: 'metrics' | 'orders' | 'finance.statement';
  readonly state: 'queued' | 'running' | 'completed' | 'failed' | 'expired';
  readonly recordCount: number;
  readonly objectHash: string | null;
  readonly objectSize: number | null;
  readonly scanState: 'pending' | 'clean' | 'rejected' | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly generatedAt: string | null;
  readonly download?: Readonly<{ url: string; expiresAt: string }>;
}
