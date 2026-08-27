export const EXPORT_REPORTS = Object.freeze(['metrics', 'orders', 'finance.statement'] as const);
export type ExportReport = typeof EXPORT_REPORTS[number];
export type ExportState = 'queued' | 'running' | 'completed' | 'failed' | 'expired';

export interface ExportJob {
  readonly id: string;
  readonly scope: string;
  readonly report: ExportReport;
  readonly filter: Readonly<Record<string, unknown>>;
  readonly state: ExportState;
  readonly cursor: string | null;
  readonly recordCount: number;
  readonly objectReference: string | null;
  readonly objectHash: string | null;
  readonly objectSize: number | null;
  readonly scanState: 'pending' | 'clean' | 'rejected' | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly generatedAt: string | null;
}

export interface ExportRow {
  readonly key: string;
  readonly values: readonly unknown[];
}

export function exportReport(value: string): ExportReport {
  if (!EXPORT_REPORTS.includes(value as ExportReport)) throw new Error('REPORT_EXPORT_TYPE_UNSUPPORTED');
  return value as ExportReport;
}

export function exportHeader(report: ExportReport): readonly string[] {
  if (report === 'metrics') return Object.freeze(['metricCode','metricVersion','scope','periodFrom','periodTo','timezone','dimensions','value','unit',
    'currency','watermark','projectionVersion','filter','generatedAt']);
  if (report === 'orders') return Object.freeze(['orderId','orderNumber','paymentState','fulfillmentState','aftersaleState','totalMinor','currency','occurredAt']);
  return Object.freeze(['statementId','periodStart','periodEnd','currency','openingMinor','debitMinor','creditMinor','closingMinor','state']);
}
