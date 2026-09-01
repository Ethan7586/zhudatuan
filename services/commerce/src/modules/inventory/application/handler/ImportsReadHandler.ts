import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { InventoryImportRecord, InventoryImportRepository } from '../port/InventoryImportRepository';

type ReadReply = OperationReply<OperationOutputFor<'inventory.imports.read'>>;

export class ImportsReadHandler implements DurableOperationHandler<'inventory.imports.read', null, InventoryImportRecord, 'read'> {
  readonly operation = 'inventory.imports.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly imports: InventoryImportRepository,
    private readonly objects: ObjectStore
  ) {}

  prepare(_input: OperationInputFor<'inventory.imports.read'>, _context: PrepareContext<'inventory.imports.read'>): Promise<null> {
    return Promise.resolve(null);
  }

  async commit(input: OperationInputFor<'inventory.imports.read'>, _prepared: null, context: HandlerContext<'inventory.imports.read'>) {
    const access = requireSession(context.security);
    const id = queryText(input.query?.job);
    if (!id) throw new DomainError('VALIDATION_FAILED', { field: 'job' });
    const record = await this.imports.read(context.transaction, id, access.scope.id);
    if (!record) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze({ checkpoint: record, response: response(record) });
  }

  async finalize(_input: OperationInputFor<'inventory.imports.read'>, record: InventoryImportRecord, _context: FinalizeContext<'inventory.imports.read'>): Promise<ReadReply> {
    const base = response(record);
    if (!record.report_object_ref) return base;
    if (!record.report_sha256 || record.report_size === null) throw new Error('IMPORT_REPORT_INVALID');
    const download = await this.objects.authorize(record.report_object_ref, 300);
    return { ...base, body: { ...base.body, report: { sha256: record.report_sha256, size: record.report_size, download: download.url } } };
  }
}

function response(record: InventoryImportRecord): ReadReply {
  return {
    status: 200,
    body: {
      id: record.id,
      state: record.state,
      total_count: record.total_count,
      cursor_value: record.cursor_value,
      success_count: record.success_count,
      failure_count: record.failure_count,
      validation_summary: record.validation_summary,
      last_error: record.last_error,
      errors: [...record.errors],
      created_at: record.created_at,
      updated_at: record.updated_at,
    },
  };
}

function queryText(value: unknown): string {
  const selected = Array.isArray(value) ? value[0] : value;
  return typeof selected === 'string' ? selected.trim().slice(0, 128) : '';
}
