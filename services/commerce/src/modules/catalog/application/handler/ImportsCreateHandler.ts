import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { JobScheduler } from '../../../../foundation/application/JobScheduler';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { ImportObjectService } from '../../../../foundation/application/ImportObjectService';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { CatalogImportRepository } from '../port/CatalogImportRepository';

interface PreparedImport {
  readonly scope: string;
  readonly reference: string;
  readonly sha256: string;
}

export class ImportsCreateHandler implements DurableOperationHandler<'catalog.imports.create', PreparedImport, OperationOutputFor<'catalog.imports.create'>, 'write'> {
  readonly operation = 'catalog.imports.create' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly imports: CatalogImportRepository,
    private readonly jobs: JobScheduler,
    private readonly objects: ImportObjectService
  ) {}

  async prepare(input: OperationInputFor<'catalog.imports.create'>, context: PrepareContext<'catalog.imports.create'>): Promise<PreparedImport> {
    const access = requireSession(context.security);
    return Object.freeze({ scope: access.scope.id, ...(await this.objects.prepare(input)) });
  }

  async commit(_input: OperationInputFor<'catalog.imports.create'>, prepared: PreparedImport, context: CommitContext<'catalog.imports.create'>) {
    const id = `catalogimport:${randomUUID()}`;
    const body = await this.imports.create(context.transaction, { id, scope: prepared.scope, reference: prepared.reference, sha256: prepared.sha256 });
    await this.jobs.schedule(context.transaction, { id: `job:${id}:0`, kind: 'catalogimport', owner: 'catalog', scope: prepared.scope, payload: { import: id }, priority: 100 });
    const response = { status: 202, body: body as unknown as OperationOutputFor<'catalog.imports.create'> } as const;
    return Object.freeze({ checkpoint: response.body, response });
  }

  finalize(
    _input: OperationInputFor<'catalog.imports.create'>,
    checkpoint: OperationOutputFor<'catalog.imports.create'>,
    _context: FinalizeContext<'catalog.imports.create'>
  ): Promise<OperationReply<OperationOutputFor<'catalog.imports.create'>>> {
    return Promise.resolve({ status: 202, body: checkpoint });
  }
}
