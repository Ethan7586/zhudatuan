import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ExportJob, ExportReport, ExportSnapshot } from '../../domain/model/ExportJob';
import type { CockpitQuery, CockpitSummary, MetricQuery, MetricRow } from '../../domain/model/Metric';
import type { DataWatermark } from '../../domain/model/ReportSnapshot';

export interface ReportRepository {
  metrics(context: ReadTransactionContext, query: MetricQuery): Promise<readonly MetricRow[]>;
  watermark(context: ReadTransactionContext, scope: string): Promise<DataWatermark>;
  cockpit(context: ReadTransactionContext, query: CockpitQuery): Promise<CockpitSummary>;
  export(context: ReadTransactionContext, id: string, scope: string): Promise<ExportJob | null>;
  createExport(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; report: ExportReport; filter: Readonly<Record<string, unknown>>; snapshot: ExportSnapshot; actor: string; membership: string; trace: string }>): Promise<ExportJob>;
}
