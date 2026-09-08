import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ImportPort, RuntimeImportRecord } from '../../../runtime/public';
import type { ObjectStore } from '../../../runtime/public/ObjectPort';

export class ImportsReadHandler implements DurableOperationHandler<'finance.statementimports.read', undefined, RuntimeImportRecord, 'read'> {
  readonly operation = 'finance.statementimports.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly imports: ImportPort,
    private readonly objects: ObjectStore
  ) {}

  prepare(_input: OperationInputFor<'finance.statementimports.read'>, _context: PrepareContext<'finance.statementimports.read'>): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  async commit(input: OperationInputFor<'finance.statementimports.read'>, _prepared: undefined, context: HandlerContext<'finance.statementimports.read'>) {
    const access = requireSession(context.security);
    const record = await this.imports.read(context.transaction, input.path.importid, access.scope.id, 'finance');
    if (!record) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze({ checkpoint: record, response: { status: 200, body: record.body as OperationOutputFor<'finance.statementimports.read'> } as const });
  }

  async finalize(
    _input: OperationInputFor<'finance.statementimports.read'>,
    checkpoint: RuntimeImportRecord,
    _context: FinalizeContext<'finance.statementimports.read'>
  ): Promise<OperationReply<OperationOutputFor<'finance.statementimports.read'>>> {
    const body = checkpoint.body;
    if (checkpoint.report === null) return { status: 200, body: body as OperationOutputFor<'finance.statementimports.read'> };
    const download = await this.objects.authorize(checkpoint.report.reference, 300);
    return { status: 200, body: { ...body, report: { sha256: checkpoint.report.sha256, size: checkpoint.report.size, download: download.url } } as OperationOutputFor<'finance.statementimports.read'> };
  }
}
