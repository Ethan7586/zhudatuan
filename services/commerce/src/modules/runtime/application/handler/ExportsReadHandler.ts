import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { TaskRepository } from '../port/TaskRepository';

export class ExportsReadHandler implements OperationHandler<'runtime.exports.read', 'read'> {
  readonly operation = 'runtime.exports.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly tasks: TaskRepository) {}

  async execute(input: OperationInputFor<'runtime.exports.read'>, context: HandlerContext<'runtime.exports.read'>): Promise<OperationReply<OperationOutputFor<'runtime.exports.read'>>> {
    const access = requireSession(context.security);
    const task = await this.tasks.read(context.transaction, input.path.exportid, access.scope.id, access.actor.id);
    if (!task || task.snapshot().type !== 'export') throw new DomainError('RESOURCE_NOT_FOUND');
    return { status: 200, body: task.snapshot() as OperationOutputFor<'runtime.exports.read'> };
  }
}
