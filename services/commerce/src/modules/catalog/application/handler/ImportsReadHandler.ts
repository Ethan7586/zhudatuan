import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ObjectStore } from '../../../runtime/public/ObjectPort';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ImportPort, RuntimeImportRecord } from '../../../runtime/public';

export class ImportsReadHandler implements DurableOperationHandler<'catalog.imports.read', undefined, RuntimeImportRecord, 'read'> {
  readonly operation = 'catalog.imports.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly imports: ImportPort,
    private readonly objects: ObjectStore
  ) {}
  prepare(_input: OperationInputFor<'catalog.imports.read'>, _context: PrepareContext<'catalog.imports.read'>): Promise<undefined> {
    return Promise.resolve(undefined);
  }
  async commit(input: OperationInputFor<'catalog.imports.read'>, _prepared: undefined, context: HandlerContext<'catalog.imports.read'>) {
    const access = requireSession(context.security);
    const record = await this.imports.read(context.transaction, input.path.importid, access.scope.id, 'catalog');
    if (!record) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze({ checkpoint: record, response: { status: 200, body: record.body as unknown as OperationOutputFor<'catalog.imports.read'> } as const });
  }
  async finalize(_input: OperationInputFor<'catalog.imports.read'>, checkpoint: RuntimeImportRecord, _context: FinalizeContext<'catalog.imports.read'>): Promise<OperationReply<OperationOutputFor<'catalog.imports.read'>>> {
    const body = checkpoint.body;
    if (checkpoint.report === null) return { status: 200, body: body as unknown as OperationOutputFor<'catalog.imports.read'> };
    const download = await this.objects.authorize(checkpoint.report.reference, 300);
    return { status: 200, body: { ...body, report: { sha256: checkpoint.report.sha256, size: checkpoint.report.size, download: download.url } } as unknown as OperationOutputFor<'catalog.imports.read'> };
  }
}
