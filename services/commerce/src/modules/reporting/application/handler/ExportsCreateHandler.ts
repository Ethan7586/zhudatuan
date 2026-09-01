import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { JobScheduler } from '../../../../foundation/application/JobScheduler';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { exportReport, type ExportFilterValue } from '../../domain/model/ExportJob';
import type { ReportRepository } from '../port/ReportRepository';

export class ExportsCreateHandler implements OperationHandler<'reporting.exports.create', 'write'> {
  readonly operation = 'reporting.exports.create' as const;
  readonly mode = 'write' as const;

  constructor(
    private readonly reports: ReportRepository,
    private readonly jobs: JobScheduler
  ) {}

  async execute(input: OperationInputFor<'reporting.exports.create'>, context: WriteHandlerContext<'reporting.exports.create'>): Promise<OperationReply<OperationOutputFor<'reporting.exports.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const report = exportReport(typeof body.report === 'string' ? body.report : 'metrics');
    const filter = filterRecord(body.filter ?? {});
    const id = `export:${randomUUID()}`;
    const job = await this.reports.createExport(context.transaction, {
      id,
      scope: access.scope.id,
      report,
      filter,
      actor: access.actor.id,
      membership: access.membership.id,
      trace: context.traceId,
    });
    await this.jobs.schedule(context.transaction, { id: `job:${id}`, kind: 'export', owner: 'reporting', scope: access.scope.id, payload: { export: id }, priority: 100 });
    return { status: 202, body: job };
  }
}

function filterRecord(value: unknown): Readonly<Record<string, ExportFilterValue>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 16_384) throw new Error('REPORT_FILTER_INVALID');
  return value as Readonly<Record<string, ExportFilterValue>>;
}
