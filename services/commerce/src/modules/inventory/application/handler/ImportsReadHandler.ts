import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ObjectStore } from '../../../runtime/public/ObjectPort';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ImportPort, RuntimeImportRecord } from '../../../runtime/public';

type ReadReply = OperationReply<OperationOutputFor<'inventory.imports.read'>>;

export class ImportsReadHandler implements DurableOperationHandler<'inventory.imports.read', null, RuntimeImportRecord, 'read'> {
  readonly operation = 'inventory.imports.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly imports: ImportPort,
    private readonly objects: ObjectStore
  ) {}

  prepare(_input: OperationInputFor<'inventory.imports.read'>, _context: PrepareContext<'inventory.imports.read'>): Promise<null> {
    return Promise.resolve(null);
  }

  async commit(input: OperationInputFor<'inventory.imports.read'>, _prepared: null, context: HandlerContext<'inventory.imports.read'>) {
    const access = requireSession(context.security);
    const id = queryText(input.query?.job);
    if (!id) throw new DomainError('VALIDATION_FAILED', { field: 'job' });
    const record = await this.imports.read(context.transaction, id, access.scope.id, 'inventory');
    if (!record) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze({ checkpoint: record, response: response(record) });
  }

  async finalize(_input: OperationInputFor<'inventory.imports.read'>, record: RuntimeImportRecord, _context: FinalizeContext<'inventory.imports.read'>): Promise<ReadReply> {
    const base = response(record);
    if (record.report === null) return base;
    const download = await this.objects.authorize(record.report.reference, 300);
    return { ...base, body: { ...base.body, report: { sha256: record.report.sha256, size: record.report.size, download: download.url } } as OperationOutputFor<'inventory.imports.read'> };
  }
}

function response(record: RuntimeImportRecord): ReadReply {
  return {
    status: 200,
    body: record.body as unknown as OperationOutputFor<'inventory.imports.read'>,
  };
}

function queryText(value: unknown): string {
  const selected = Array.isArray(value) ? value[0] : value;
  return typeof selected === 'string' ? selected.trim().slice(0, 128) : '';
}
