import { OP_RUNTIME_EXPORTS_CANCEL, OP_RUNTIME_JOBS_CANCEL } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { Task } from '../model/Task';
import type { TaskPort } from '../public';

export class CancelTask {
  constructor(private readonly port: Pick<TaskPort, 'cancel'>) {}

  execute(context: ConsoleContext, task: Task, reason: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, task.type === 'export' ? OP_RUNTIME_EXPORTS_CANCEL : OP_RUNTIME_JOBS_CANCEL);
    if (!task.cancellable) throw new Error('TASK_NOT_CANCELLABLE');
    if (reason.trim().length < 2) throw new Error('TASK_REASON_REQUIRED');
    return this.port.cancel(context, task, reason.trim(), identity, signal);
  }
}
