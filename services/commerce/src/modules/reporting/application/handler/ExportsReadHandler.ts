import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ObjectStore } from '../../../runtime/public/ObjectPort';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ExportJob } from '../../domain/model/ExportJob';
import type { ReportRepository } from '../port/ReportRepository';

type ExportReply = OperationReply<OperationOutputFor<'reporting.exports.read'>>;

export class ExportsReadHandler implements DurableOperationHandler<'reporting.exports.read', null, ExportJob, 'read'> {
  readonly operation = 'reporting.exports.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly reports: ReportRepository,
    private readonly objects: ObjectStore
  ) {}

  prepare(_input: OperationInputFor<'reporting.exports.read'>, _context: PrepareContext<'reporting.exports.read'>): Promise<null> {
    return Promise.resolve(null);
  }

  async commit(input: OperationInputFor<'reporting.exports.read'>, _prepared: null, context: HandlerContext<'reporting.exports.read'>) {
    const access = requireSession(context.security);
    const job = await this.reports.export(context.transaction, input.path.exportid, access.scope.id);
    if (!job) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze({ checkpoint: job, response: { status: 200, body: job } as ExportReply });
  }

  async finalize(_input: OperationInputFor<'reporting.exports.read'>, job: ExportJob, _context: FinalizeContext<'reporting.exports.read'>): Promise<ExportReply> {
    if (job.state !== 'completed') return { status: 200, body: job };
    if (!job.objectReference || job.scanState !== 'clean') throw new Error('REPORT_EXPORT_OBJECT_INVALID');
    const download = await this.objects.authorize(job.objectReference, 300);
    return { status: 200, body: { ...job, download } };
  }
}
