import type { ContractJsonValue } from '@shop/contract';
import type { DataWatermark } from './ReportSnapshot';

export const EXPORT_REPORTS = Object.freeze(['metrics', 'orders', 'finance.statement'] as const);
export type ExportReport = (typeof EXPORT_REPORTS)[number];
export type ExportState = 'queued' | 'running' | 'completed' | 'failed' | 'expired';
export type ExportFilterValue = ContractJsonValue;

export interface ExportSnapshot {
  readonly filter: Readonly<Record<string, ExportFilterValue>>;
  readonly watermark: DataWatermark;
  readonly generatedAt: string;
  readonly generationVersion: number;
}

export interface ExportJob {
  readonly id: string;
  readonly scope: string;
  readonly report: ExportReport;
  readonly filter: Readonly<Record<string, ExportFilterValue>>;
  readonly snapshot: ExportSnapshot;
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

export function exportSnapshot(filter: Readonly<Record<string, ExportFilterValue>>, watermark: DataWatermark, generatedAt: string, generationVersion = 1): ExportSnapshot {
  if (Number.isNaN(Date.parse(generatedAt)) || JSON.stringify(filter).length > 16_384 || !Number.isSafeInteger(generationVersion) || generationVersion < 1) throw new Error('REPORT_EXPORT_SNAPSHOT_INVALID');
  return Object.freeze({
    filter: Object.freeze({ ...filter }),
    watermark: Object.freeze({ ...watermark }),
    generatedAt,
    generationVersion,
  });
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
  if (report === 'metrics')
    return Object.freeze([
      'metricCode',
      'metricVersion',
      'metricName',
      'formula',
      'availableDimensions',
      'granularity',
      'owner',
      'scope',
      'periodFrom',
      'periodTo',
      'timezone',
      'dimensions',
      'value',
      'unit',
      'currency',
      'watermark',
      'projectionVersion',
      'filter',
      'generatedAt',
    ]);
  if (report === 'orders')
    return Object.freeze(['orderNumber', 'externalOrderNumber', 'sourceChannel', 'paymentState', 'fulfillmentState', 'aftersaleState', 'lifecycleState', 'verificationState', 'totalMinor', 'currency', 'orderedAt', 'exportWatermark']);
  return Object.freeze(['statementId', 'periodStart', 'periodEnd', 'currency', 'openingMinor', 'debitMinor', 'creditMinor', 'closingMinor', 'state']);
}
