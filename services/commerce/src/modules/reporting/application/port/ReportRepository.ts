import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ExportJob, ExportReport } from '../../domain/model/ExportJob';
import type { CockpitSummary, MetricQuery, MetricRow } from '../../domain/model/Metric';

export interface ReportRepository {
  metrics(context: ReadTransactionContext, query: MetricQuery): Promise<readonly MetricRow[]>;
  cockpit(context: ReadTransactionContext, scope: string): Promise<CockpitSummary>;
  export(context: ReadTransactionContext, id: string, scope: string): Promise<ExportJob | null>;
  createExport(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; report: ExportReport; filter: Readonly<Record<string, unknown>>; actor: string; membership: string; trace: string }>): Promise<ExportJob>;
}
