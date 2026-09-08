import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { TaskRepository } from '../port/TaskRepository';

export class JobsCancelHandler implements OperationHandler<'runtime.jobs.cancel', 'write'> {
  readonly operation = 'runtime.jobs.cancel' as const;
  readonly mode = 'write' as const;
  constructor(private readonly tasks: TaskRepository) {}

  async execute(input: OperationInputFor<'runtime.jobs.cancel'>, context: WriteHandlerContext<'runtime.jobs.cancel'>): Promise<OperationReply<OperationOutputFor<'runtime.jobs.cancel'>>> {
    const access = requireSession(context.security);
    const task = await this.tasks.cancel(context.transaction, {
      id: input.path.jobid,
      scope: access.scope.id,
      actor: access.actor.id,
      expectedVersion: context.expectedVersion!,
      reason: textField(bodyRecord(input), 'reason', 500),
    });
    if (!task) throw new DomainError('RESOURCE_NOT_FOUND');
    return { status: 200, body: task.snapshot() as OperationOutputFor<'runtime.jobs.cancel'> };
  }
}
