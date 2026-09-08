import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { DomainError } from '../../../../platform/error/DomainError';
import type { JobPort } from '../../../runtime/public';
import { exportSnapshot } from '../../domain/model/ExportJob';
import { ReportSnapshot } from '../../domain/model/ReportSnapshot';
import { exportFilter, metricExportQuery } from '../../domain/value/ExportFilter';
import type { ReportRepository } from '../port/ReportRepository';

export class ExportsCreateHandler implements OperationHandler<'reporting.exports.create', 'write'> {
  readonly operation = 'reporting.exports.create' as const;
  readonly mode = 'write' as const;

  constructor(
    private readonly reports: ReportRepository,
    private readonly jobs: JobPort
  ) {}

  async execute(input: OperationInputFor<'reporting.exports.create'>, context: WriteHandlerContext<'reporting.exports.create'>): Promise<OperationReply<OperationOutputFor<'reporting.exports.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    if (body.report !== 'metrics') throw new Error('REPORT_EXPORT_TYPE_UNSUPPORTED');
    const report = 'metrics' as const;
    const filter = exportFilter(report, body.filter);
    const current = await this.reports.watermark(context.transaction, access.scope.id);
    const selected = ReportSnapshot.restore(body.snapshot, metricExportQuery(access.scope.id, filter));
    if (
      selected.watermark.version > current.version ||
      Date.parse(selected.watermark.occurredAt) > Date.parse(current.occurredAt) ||
      Date.parse(selected.generatedAt) > Date.now() ||
      (selected.watermark.version === current.version && selected.watermark.event !== current.event)
    ) {
      throw new Error('REPORT_EXPORT_SNAPSHOT_INVALID');
    }
    const snapshot = exportSnapshot(filter, selected.watermark, selected.generatedAt, selected.generationVersion);
    const id = `export:${randomUUID()}`;
    if (!context.idempotencyKey) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED');
    const job = await this.reports.createExport(context.transaction, {
      id,
      scope: access.scope.id,
      report,
      filter,
      snapshot,
      actor: access.actor.id,
      membership: access.membership.id,
      trace: context.traceId,
    });
    await this.jobs.create(context.transaction, {
      scope: access.scope.id,
      owner: 'reporting',
      kind: 'export',
      queue: 'export',
      payload: { export: id },
      idempotency: context.idempotencyKey,
      actor: access.actor.id,
    });
    return { status: 202, body: job };
  }
}
