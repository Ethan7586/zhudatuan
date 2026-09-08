import type { ExportJob, ExportReport, ExportRow, MetricExportRow } from '../../domain/model/ExportJob';
import type { MetricContribution } from '../../domain/model/Metric';
import type { OrderProjection, ProjectionEvent } from '../../domain/model/Projection';

export interface ReportingPort {
  createRequestedExport(event: ProjectionEvent): Promise<void>;
  claimEvent(event: string): Promise<ProjectionEvent | null>;
  period(occurredAt: string, timezone: string): Promise<Readonly<{ from: string; to: string }>>;
  addMetrics(metrics: readonly MetricContribution[], event: string): Promise<void>;
  orderApplication(order: string): Promise<string>;
  createOrder(projection: OrderProjection): Promise<void>;
  payOrder(order: string, amountMinor: number, currency: string, snapshot: Readonly<Record<string, unknown>>, watermark: string, event: string): Promise<void>;
  cancelOrder(order: string, watermark: string, event: string): Promise<void>;
  shipOrder(order: string, state: string, watermark: string, event: string): Promise<void>;
  saveStatement(scope: string, payload: Readonly<Record<string, unknown>>, watermark: string, event: string): Promise<void>;
  completeEvent(event: ProjectionEvent, scopes: readonly string[]): Promise<readonly Readonly<{ scope: string; version: number }>[]>;
  claimExport(id: string): Promise<ExportJob | null>;
  exportRows(id: string, report: Exclude<ExportReport, 'metrics'>, cursor: string | null, fetch: number): Promise<readonly ExportRow[]>;
  metricExportRows(id: string, cursor: string | null, fetch: number): Promise<readonly MetricExportRow[]>;
  exportCount(id: string, report: ExportReport): Promise<number | null>;
  advanceExport(id: string, cursor: string, count: number): Promise<void>;
  completeExport(id: string, object: Readonly<{ reference: string; sha256: string; size: number; scan: 'clean' }>): Promise<void>;
  failExport(id: string, code: string, terminal: boolean): Promise<void>;
}

export interface ReportingFactory<TDatabase> {
  (database: TDatabase): ReportingPort;
}
