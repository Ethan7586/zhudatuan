import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ObjectStore } from '../../../runtime/public/ObjectPort';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ImportPort, RuntimeImportRecord } from '../../../runtime/public';

export class ImportsReadHandler implements DurableOperationHandler<'member.imports.read', undefined, RuntimeImportRecord, 'read'> {
  readonly operation = 'member.imports.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly imports: ImportPort,
    private readonly objects: ObjectStore
  ) {}

  prepare(_input: OperationInputFor<'member.imports.read'>, _context: PrepareContext<'member.imports.read'>): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  async commit(input: OperationInputFor<'member.imports.read'>, _prepared: undefined, context: HandlerContext<'member.imports.read'>) {
    const access = requireSession(context.security);
    const record = await this.imports.read(context.transaction, input.path.importid, access.scope.id, 'member');
    if (!record) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze({ checkpoint: record, response: { status: 200, body: record.body as OperationOutputFor<'member.imports.read'> } as const });
  }

  async finalize(_input: OperationInputFor<'member.imports.read'>, checkpoint: RuntimeImportRecord, _context: FinalizeContext<'member.imports.read'>): Promise<OperationReply<OperationOutputFor<'member.imports.read'>>> {
    const body = checkpoint.body;
    if (checkpoint.report === null) return { status: 200, body: body as OperationOutputFor<'member.imports.read'> };
    const download = await this.objects.authorize(checkpoint.report.reference, 300);
    return { status: 200, body: { ...body, report: { sha256: checkpoint.report.sha256, size: checkpoint.report.size, download: download.url } } as unknown as OperationOutputFor<'member.imports.read'> };
  }
}
