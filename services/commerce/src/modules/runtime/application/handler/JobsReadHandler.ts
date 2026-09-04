import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage, queryText } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { TaskRepository } from '../port/TaskRepository';
import type { RuntimeTaskState, RuntimeTaskType } from '../../domain/model/Task';

export class JobsReadHandler implements OperationHandler<'runtime.jobs.read', 'read'> {
  readonly operation = 'runtime.jobs.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly tasks: TaskRepository) {}

  async execute(input: OperationInputFor<'runtime.jobs.read'>, context: HandlerContext<'runtime.jobs.read'>): Promise<OperationReply<OperationOutputFor<'runtime.jobs.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input, 100);
    const rows = await this.tasks.list(context.transaction, {
      scope: access.scope.id,
      actor: access.actor.id,
      type: queryText(input, 'type', 16) as RuntimeTaskType | null,
      state: queryText(input, 'state', 32) as RuntimeTaskState | null,
      owner: queryText(input, 'owner', 32),
      cursorTime: page.sort,
      cursorId: page.id,
      fetch: page.fetch,
    });
    return { status: 200, body: keysetPage(rows.map((task) => task.snapshot()), page, 'createdAt', 'id') as OperationOutputFor<'runtime.jobs.read'> };
  }
}
