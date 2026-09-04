import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { JobScheduler } from '../../../../foundation/application/JobScheduler';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { TaskRepository } from '../port/TaskRepository';
import { ImportRegistry } from '../registry/ImportRegistry';

export class ImportsConfirmHandler implements OperationHandler<'runtime.imports.confirm', 'write'> {
  readonly operation = 'runtime.imports.confirm' as const;
  readonly mode = 'write' as const;

  constructor(private readonly tasks: TaskRepository, private readonly jobs: JobScheduler, private readonly registry: ImportRegistry) {}

  async execute(input: OperationInputFor<'runtime.imports.confirm'>, context: WriteHandlerContext<'runtime.imports.confirm'>): Promise<OperationReply<OperationOutputFor<'runtime.imports.confirm'>>> {
    const access = requireSession(context.security);
    const current = await this.tasks.read(context.transaction, input.path.importid, access.scope.id, access.actor.id);
    const snapshot = current?.snapshot();
    if (!snapshot || snapshot.type !== 'import') throw new DomainError('RESOURCE_NOT_FOUND');
    const descriptor = this.registry.get(snapshot.owner, snapshot.kind);
    if (!descriptor) throw new DomainError('VALIDATION_FAILED', { field: 'kind' });
    const previewHash = textField(bodyRecord(input), 'previewHash', 64);
    if (!/^[a-f0-9]{64}$/.test(previewHash)) throw new DomainError('VALIDATION_FAILED', { field: 'previewHash' });
    const task = await this.tasks.confirmImport(context.transaction, {
      id: snapshot.id,
      scope: access.scope.id,
      actor: access.actor.id,
      expectedVersion: context.expectedVersion!,
      previewHash,
      reason: '用户确认预检结果并提交执行',
    });
    if (!task) throw new DomainError('RESOURCE_NOT_FOUND');
    const confirmed = task.snapshot();
    await this.jobs.schedule(context.transaction, {
      id: `job:${confirmed.id}:confirm:${confirmed.version}`,
      kind: descriptor.job,
      owner: descriptor.owner,
      scope: access.scope.id,
      payload: { import: confirmed.id },
      priority: 100,
    });
    return { status: 202, body: confirmed as OperationOutputFor<'runtime.imports.confirm'> };
  }
}
