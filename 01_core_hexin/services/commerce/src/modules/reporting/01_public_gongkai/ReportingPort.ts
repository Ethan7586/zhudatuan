import type { ExportJob, ExportReport, ExportRow } from '../02_domain_yewu/model/ExportJob';
import type { CockpitSummary, Metric, MetricQuery, MetricRow } from '../02_domain_yewu/model/Metric';
import type { OrderProjection, ProjectionEvent } from '../02_domain_yewu/model/Projection';

export interface ReportingPort {
  metrics(query: MetricQuery): Promise<readonly MetricRow[]>;
  cockpit(scope: string, supplier: string | null, period: MetricQuery['period']): Promise<CockpitSummary>;
  exports(scope: string, report: ExportReport, fetch: number): Promise<readonly ExportJob[]>;
  export(id: string, scope: string): Promise<ExportJob | null>;
  createExport(input: Readonly<{ id: string; scope: string; report: ExportReport; filter: Readonly<Record<string, unknown>>;
    actor: string; membership: string; scopeKind: string; trace: string }>): Promise<ExportJob>;
  claimEvent(event: string): Promise<ProjectionEvent | null>;
  period(occurredAt: string, timezone: string): Promise<Readonly<{ from: string; to: string }>>;
  addMetrics(metrics: readonly Metric[]): Promise<void>;
  createOrder(projection: OrderProjection): Promise<void>;
  payOrder(order: string, amountMinor: number, currency: string, snapshot: Readonly<Record<string, unknown>>, watermark: string): Promise<void>;
  cancelOrder(order: string, watermark: string): Promise<void>;
  shipOrder(order: string, state: string, watermark: string): Promise<void>;
  saveStatement(scope: string, payload: Readonly<Record<string, unknown>>, watermark: string): Promise<void>;
  completeEvent(event: ProjectionEvent, scopes: readonly string[]): Promise<readonly Readonly<{ scope: string; version: number }>[] >;
  claimExport(id: string): Promise<ExportJob | null>;
  exportRows(id: string, report: ExportReport, filter: Readonly<Record<string, unknown>>, cursor: string | null, fetch: number): Promise<readonly ExportRow[]>;
  advanceExport(id: string, cursor: string, count: number): Promise<void>;
  completeExport(id: string, object: Readonly<{ reference: string; sha256: string; size: number; scan: 'clean' }>): Promise<void>;
  failExport(id: string, code: string, terminal: boolean): Promise<void>;
}

export interface ReportingFactory<TDatabase> {
  (database: TDatabase): ReportingPort;
}
