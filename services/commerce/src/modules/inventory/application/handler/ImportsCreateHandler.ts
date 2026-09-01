import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { JobScheduler } from '../../../../foundation/application/JobScheduler';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { ImportObjectService } from '../../../../foundation/application/ImportObjectService';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { InventoryImportRecord, InventoryImportRepository } from '../port/InventoryImportRepository';

interface PreparedImport {
  readonly scope: string;
  readonly reference: string;
  readonly sha256: string;
}

type ImportReply = OperationReply<OperationOutputFor<'inventory.imports.create'>>;

export class ImportsCreateHandler implements DurableOperationHandler<'inventory.imports.create', PreparedImport, ImportReply, 'write'> {
  readonly operation = 'inventory.imports.create' as const;
  readonly mode = 'write' as const;

  constructor(
    private readonly imports: InventoryImportRepository,
    private readonly jobs: JobScheduler,
    private readonly objects: ImportObjectService
  ) {}

  async prepare(input: OperationInputFor<'inventory.imports.create'>, context: PrepareContext<'inventory.imports.create'>): Promise<PreparedImport> {
    const access = requireSession(context.security);
    return Object.freeze({ scope: access.scope.id, ...(await this.objects.prepare(input)) });
  }

  async commit(_input: OperationInputFor<'inventory.imports.create'>, prepared: PreparedImport, context: CommitContext<'inventory.imports.create'>) {
    const id = `inventoryimport:${randomUUID()}`;
    const record = await this.imports.create(context.transaction, { id, ...prepared });
    await this.jobs.schedule(context.transaction, { id: `job:${id}:0`, kind: 'inventoryimport', owner: 'inventory', scope: prepared.scope, payload: { import: id }, priority: 100 });
    const response = reply(record);
    return Object.freeze({ checkpoint: response, response });
  }

  finalize(_input: OperationInputFor<'inventory.imports.create'>, checkpoint: ImportReply): Promise<ImportReply> {
    return Promise.resolve(checkpoint);
  }
}

function reply(record: InventoryImportRecord): ImportReply {
  return {
    status: 202,
    body: {
      id: record.id,
      state: record.state,
      total_count: record.total_count,
      cursor_value: record.cursor_value,
      success_count: record.success_count,
      failure_count: record.failure_count,
      created_at: record.created_at,
      updated_at: record.updated_at,
    },
  };
}
