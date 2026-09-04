import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { JobScheduler } from '../../../../foundation/application/JobScheduler';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { TaskRepository } from '../port/TaskRepository';
import { ImportRegistry } from '../registry/ImportRegistry';

export class ImportsRetryHandler implements OperationHandler<'runtime.imports.retry', 'write'> {
  readonly operation = 'runtime.imports.retry' as const;
  readonly mode = 'write' as const;
  constructor(private readonly tasks: TaskRepository, private readonly jobs: JobScheduler, private readonly registry: ImportRegistry) {}

  async execute(input: OperationInputFor<'runtime.imports.retry'>, context: WriteHandlerContext<'runtime.imports.retry'>): Promise<OperationReply<OperationOutputFor<'runtime.imports.retry'>>> {
    const access = requireSession(context.security);
    const current = await this.tasks.read(context.transaction, input.path.importid, access.scope.id, access.actor.id);
    const snapshot = current?.snapshot();
    if (!snapshot || snapshot.type !== 'import') throw new DomainError('RESOURCE_NOT_FOUND');
    const descriptor = this.registry.get(snapshot.owner, snapshot.kind);
    if (!descriptor) throw new DomainError('VALIDATION_FAILED', { field: 'kind' });
    const task = await this.tasks.retryImport(context.transaction, {
      id: snapshot.id,
      scope: access.scope.id,
      actor: access.actor.id,
      expectedVersion: context.expectedVersion!,
      reason: textField(bodyRecord(input), 'reason', 500),
    });
    if (!task) throw new DomainError('RESOURCE_NOT_FOUND');
    const retried = task.snapshot();
    await this.jobs.schedule(context.transaction, {
      id: `job:${retried.id}:retry:${retried.version}`,
      kind: descriptor.job,
      owner: descriptor.owner,
      scope: access.scope.id,
      payload: { import: retried.id },
      priority: 100,
    });
    return { status: 202, body: retried as OperationOutputFor<'runtime.imports.retry'> };
  }
}
