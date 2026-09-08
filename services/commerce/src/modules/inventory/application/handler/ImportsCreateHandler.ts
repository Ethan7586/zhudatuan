import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { JobScheduler } from '../../../../pipeline/JobScheduler';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { ImportObjectPort, ImportPort } from '../../../runtime/public';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { authorizationEvidence } from '../../../../platform/security/AuthorizationEvidence';

interface PreparedImport {
  readonly scope: string;
  readonly reference: string;
  readonly sha256: string;
  readonly name: string;
  readonly mediaType: string;
  readonly size: number;
}

type ImportReply = OperationReply<OperationOutputFor<'inventory.imports.create'>>;

export class ImportsCreateHandler implements DurableOperationHandler<'inventory.imports.create', PreparedImport, ImportReply, 'write'> {
  readonly operation = 'inventory.imports.create' as const;
  readonly mode = 'write' as const;

  constructor(
    private readonly imports: ImportPort,
    private readonly jobs: JobScheduler,
    private readonly objects: ImportObjectPort
  ) {}

  async prepare(input: OperationInputFor<'inventory.imports.create'>, context: PrepareContext<'inventory.imports.create'>): Promise<PreparedImport> {
    const access = requireSession(context.security);
    return Object.freeze({ scope: access.scope.id, ...(await this.objects.prepare(input, access.scope.tenant ?? access.organization)) });
  }

  async commit(_input: OperationInputFor<'inventory.imports.create'>, prepared: PreparedImport, context: CommitContext<'inventory.imports.create'>) {
    const access = requireSession(context.security);
    const id = `import:${randomUUID()}`;
    const record = await this.imports.create(context.transaction, {
      id,
      scope: prepared.scope,
      owner: 'inventory',
      kind: 'stock',
      reference: prepared.reference,
      sha256: prepared.sha256,
      name: prepared.name,
      mediaType: prepared.mediaType,
      size: prepared.size,
      actor: access.actor.id,
      authorization: authorizationEvidence(access, this.operation, new Date()),
    });
    await this.jobs.schedule(context.transaction, { id: `job:${id}:0`, kind: 'inventoryimport', owner: 'inventory', scope: prepared.scope, payload: { import: id }, priority: 100 });
    const response = reply(record);
    return Object.freeze({ checkpoint: response, response });
  }

  finalize(_input: OperationInputFor<'inventory.imports.create'>, checkpoint: ImportReply): Promise<ImportReply> {
    return Promise.resolve(checkpoint);
  }
}

function reply(record: Awaited<ReturnType<ImportPort['create']>>): ImportReply {
  return {
    status: 202,
    body: record as unknown as OperationOutputFor<'inventory.imports.create'>,
  };
}
