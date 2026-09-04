import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { JobScheduler } from '../../../../foundation/application/JobScheduler';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { authorizationEvidence } from '../../../../foundation/security/AuthorizationEvidence';
import type { ImportPort } from '../../public/ImportPort';
import type { TaskRepository } from '../port/TaskRepository';
import { ImportRegistry, type ImportDescriptor } from '../registry/ImportRegistry';
import type { ImportObjectPort } from '../../public/ImportObjectPort';

interface PreparedImport {
  readonly scope: string;
  readonly actor: string;
  readonly descriptor: ImportDescriptor;
  readonly reference: string;
  readonly sha256: string;
  readonly fileName: string;
  readonly mediaType: string;
  readonly size: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export class ImportsCreateHandler implements DurableOperationHandler<'runtime.imports.create', PreparedImport, OperationOutputFor<'runtime.imports.create'>, 'write'> {
  readonly operation = 'runtime.imports.create' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly imports: ImportPort,
    private readonly tasks: TaskRepository,
    private readonly jobs: JobScheduler,
    private readonly objects: ImportObjectPort,
    private readonly registry: ImportRegistry
  ) {}

  async prepare(input: OperationInputFor<'runtime.imports.create'>, context: PrepareContext<'runtime.imports.create'>): Promise<PreparedImport> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const owner = textField(body, 'owner', 32);
    const kind = textField(body, 'kind', 32);
    const descriptor = this.registry.get(owner, kind);
    if (!descriptor) throw new DomainError('VALIDATION_FAILED', { field: 'kind' });
    if (!access.capabilities.has(descriptor.operation)) throw new DomainError('CAPABILITY_DENIED', { operation: descriptor.operation });
    const object = await this.objects.prepare(input, access.scope.tenant ?? access.organization);
    const metadata = body.metadata !== null && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? Object.freeze({ ...(body.metadata as Readonly<Record<string, unknown>>) }) : Object.freeze({});
    return Object.freeze({ scope: access.scope.id, actor: access.actor.id, descriptor, reference: object.reference, sha256: object.sha256,
      fileName: object.name, mediaType: object.mediaType, size: object.size, metadata });
  }

  async commit(_input: OperationInputFor<'runtime.imports.create'>, prepared: PreparedImport, context: CommitContext<'runtime.imports.create'>) {
    const id = `import:${randomUUID()}`;
    await this.imports.create(context.transaction, {
      id,
      scope: prepared.scope,
      owner: prepared.descriptor.owner,
      kind: prepared.descriptor.kind,
      reference: prepared.reference,
      sha256: prepared.sha256,
      name: prepared.fileName,
      mediaType: prepared.mediaType,
      size: prepared.size,
      actor: prepared.actor,
      authorization: authorizationEvidence(requireSession(context.security), prepared.descriptor.operation, new Date()),
      metadata: prepared.metadata,
    });
    await this.jobs.schedule(context.transaction, {
      id: `job:${id}:0`,
      kind: prepared.descriptor.job,
      owner: prepared.descriptor.owner,
      scope: prepared.scope,
      payload: { import: id },
      priority: 100,
    });
    const task = await this.tasks.read(context.transaction, id, prepared.scope, prepared.actor);
    if (!task) throw new Error('RUNTIME_IMPORT_TASK_MISSING');
    const checkpoint = task.snapshot() as OperationOutputFor<'runtime.imports.create'>;
    return Object.freeze({ checkpoint, response: { status: 202, body: checkpoint } as const });
  }

  finalize(_input: OperationInputFor<'runtime.imports.create'>, checkpoint: OperationOutputFor<'runtime.imports.create'>, _context: FinalizeContext<'runtime.imports.create'>): Promise<OperationReply<OperationOutputFor<'runtime.imports.create'>>> {
    return Promise.resolve({ status: 202, body: checkpoint });
  }
}
