import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { CatalogImportRecord, CatalogImportRepository } from '../port/CatalogImportRepository';

export class ImportsReadHandler implements DurableOperationHandler<'catalog.imports.read', undefined, CatalogImportRecord, 'read'> {
  readonly operation = 'catalog.imports.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly imports: CatalogImportRepository,
    private readonly objects: ObjectStore
  ) {}
  prepare(_input: OperationInputFor<'catalog.imports.read'>, _context: PrepareContext<'catalog.imports.read'>): Promise<undefined> {
    return Promise.resolve(undefined);
  }
  async commit(input: OperationInputFor<'catalog.imports.read'>, _prepared: undefined, context: HandlerContext<'catalog.imports.read'>) {
    const access = requireSession(context.security);
    const record = await this.imports.read(context.transaction, input.path.importid, access.scope.id);
    if (!record) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze({ checkpoint: record, response: { status: 200, body: withoutReport(record) as unknown as OperationOutputFor<'catalog.imports.read'> } as const });
  }
  async finalize(_input: OperationInputFor<'catalog.imports.read'>, checkpoint: CatalogImportRecord, _context: FinalizeContext<'catalog.imports.read'>): Promise<OperationReply<OperationOutputFor<'catalog.imports.read'>>> {
    const body = withoutReport(checkpoint);
    if (checkpoint.reportObjectRef === null) return { status: 200, body: body as unknown as OperationOutputFor<'catalog.imports.read'> };
    const download = await this.objects.authorize(checkpoint.reportObjectRef, 300);
    return { status: 200, body: { ...body, report: { sha256: checkpoint.reportSha256, size: checkpoint.reportSize, download } } as unknown as OperationOutputFor<'catalog.imports.read'> };
  }
}

function withoutReport(record: CatalogImportRecord): Readonly<Record<string, unknown>> {
  const { report_object_ref: _reference, report_sha256: _sha256, report_size: _size, reportObjectRef: _camelReference, reportSha256: _camelSha256, reportSize: _camelSize, ...body } = record;
  return Object.freeze(body);
}
