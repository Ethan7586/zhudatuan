import { defineModule } from '../../bootstrap/DefinedModule';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { CreateExport } from './application/command/CreateExport';
import type { ExportReport } from './domain/model/ExportJob';
import { PgReportingRepository } from './infrastructure/persistence/PgReportingRepository';
import { reportingRoutes } from './interface/http/ReportingRoutes';

export const ReportingModule = defineModule('reporting', [], reportingRoutes);

/** Stable public command used by domain owners that expose report-specific export operations. */
export function createReportingExport(request: OperationRequest, database: OperationDatabase, report: ExportReport,
  filter: Readonly<Record<string, unknown>>) {
  return new CreateExport((transaction) => new PgReportingRepository(transaction)).execute(request, database, report, filter);
}
