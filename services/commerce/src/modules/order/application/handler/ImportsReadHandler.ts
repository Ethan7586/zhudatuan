import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ObjectStore } from '../../../runtime/public/ObjectPort';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ImportPort, RuntimeImportRecord } from '../../../runtime/public';

export class ImportsReadHandler implements DurableOperationHandler<'order.imports.read', undefined, RuntimeImportRecord, 'read'> {
  readonly operation = 'order.imports.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly imports: ImportPort,
    private readonly objects: ObjectStore
  ) {}
  prepare(_input: OperationInputFor<'order.imports.read'>, _context: PrepareContext<'order.imports.read'>): Promise<undefined> {
    return Promise.resolve(undefined);
  }
  async commit(input: OperationInputFor<'order.imports.read'>, _prepared: undefined, context: HandlerContext<'order.imports.read'>) {
    const access = requireSession(context.security);
    const record = await this.imports.read(context.transaction, input.path.importid, access.scope.id, 'order');
    if (!record) throw new DomainError('RESOURCE_NOT_FOUND');
    const body = record.body;
    return Object.freeze({ checkpoint: record, response: { status: 200, body: body as unknown as OperationOutputFor<'order.imports.read'> } as const });
  }
  async finalize(_input: OperationInputFor<'order.imports.read'>, record: RuntimeImportRecord, _context: FinalizeContext<'order.imports.read'>): Promise<OperationReply<OperationOutputFor<'order.imports.read'>>> {
    const body = record.body;
    if (record.report === null) return { status: 200, body: body as unknown as OperationOutputFor<'order.imports.read'> };
    const download = await this.objects.authorize(record.report.reference, 300);
    return { status: 200, body: { ...body, report: { sha256: record.report.sha256, size: record.report.size, download: download.url } } as unknown as OperationOutputFor<'order.imports.read'> };
  }
}
