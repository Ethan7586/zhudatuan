import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import type { ExportReport } from '../02_domain_yewu/model/ExportJob';
import { CreateExport } from '../03_application_yingyong/command/CreateExport';
import { PgReportingRepository } from './persistence/PgReportingRepository';

/** Stable public command used by domain owners that expose report-specific export operations. */
export function createReportingExport(request: OperationRequest, database: OperationDatabase, report: ExportReport,
  filter: Readonly<Record<string, unknown>>) {
  return new CreateExport((transaction) => new PgReportingRepository(transaction)).execute(request, database, report, filter);
}

export function listReportingExports(database: OperationDatabase, scope: string, report: ExportReport, fetch = 20) {
  return new PgReportingRepository(database).exports(scope, report, fetch);
}
