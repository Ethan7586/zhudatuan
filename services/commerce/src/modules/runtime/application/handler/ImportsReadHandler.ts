import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { TaskRepository } from '../port/TaskRepository';

export class ImportsReadHandler implements OperationHandler<'runtime.imports.read', 'read'> {
  readonly operation = 'runtime.imports.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly tasks: TaskRepository) {}

  async execute(input: OperationInputFor<'runtime.imports.read'>, context: HandlerContext<'runtime.imports.read'>): Promise<OperationReply<OperationOutputFor<'runtime.imports.read'>>> {
    const access = requireSession(context.security);
    const task = await this.tasks.read(context.transaction, input.path.importid, access.scope.id, access.actor.id);
    if (!task || task.snapshot().type !== 'import') throw new DomainError('RESOURCE_NOT_FOUND');
    return { status: 200, body: task.snapshot() as OperationOutputFor<'runtime.imports.read'> };
  }
}
