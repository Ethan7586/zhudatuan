import { randomUUID } from 'node:crypto';
import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import { exportReport, type ExportReport } from '../../02_domain_yewu/model/ExportJob';
import type { ReportingFactory } from '../../01_public_gongkai/ReportingPort';

export class CreateExport {
  constructor(private readonly factory: ReportingFactory<OperationDatabase>) {}

  execute(request: OperationRequest, database: OperationDatabase, report: ExportReport, filter: Readonly<Record<string, unknown>>) {
    if (JSON.stringify(filter).length > 16_384) throw new Error('REPORT_FILTER_TOO_LARGE');
    const access = requireAccess(request);
    return this.factory(database).createExport({ id: `export:${randomUUID()}`, scope: access.scope.id, report, filter,
      actor: access.actor.id, membership: access.membership.id, trace: access.trace });
  }
}

export function createExportOperations(factory: ReportingFactory<OperationDatabase>): OperationActions {
  const usecase = new CreateExport(factory);
  return { 'reporting.exports.create': async (request, database) => {
    const body = bodyRecord(request);
    const report = exportReport(typeof body.report === 'string' ? body.report : 'metrics');
    const filter = record(body.filter ?? {});
    const job = await usecase.execute(request, database, report, filter);
    return { status: 202, body: job };
  } };
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('REPORT_FILTER_INVALID');
  const serialized = JSON.stringify(value);
  if (serialized.length > 16_384) throw new Error('REPORT_FILTER_TOO_LARGE');
  return value as Readonly<Record<string, unknown>>;
}
