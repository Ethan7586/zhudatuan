import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { TaskRepository } from '../port/TaskRepository';

export class ExportsCancelHandler implements OperationHandler<'runtime.exports.cancel', 'write'> {
  readonly operation = 'runtime.exports.cancel' as const;
  readonly mode = 'write' as const;
  constructor(private readonly tasks: TaskRepository) {}

  async execute(input: OperationInputFor<'runtime.exports.cancel'>, context: WriteHandlerContext<'runtime.exports.cancel'>): Promise<OperationReply<OperationOutputFor<'runtime.exports.cancel'>>> {
    const access = requireSession(context.security);
    const existing = await this.tasks.read(context.transaction, input.path.exportid, access.scope.id, access.actor.id);
    if (!existing || existing.snapshot().type !== 'export') throw new DomainError('RESOURCE_NOT_FOUND');
    const task = await this.tasks.cancel(context.transaction, {
      id: input.path.exportid,
      scope: access.scope.id,
      actor: access.actor.id,
      expectedVersion: context.expectedVersion!,
      reason: textField(bodyRecord(input), 'reason', 500),
    });
    if (!task) throw new DomainError('RESOURCE_NOT_FOUND');
    return { status: 200, body: task.snapshot() as OperationOutputFor<'runtime.exports.cancel'> };
  }
}
