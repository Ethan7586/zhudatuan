import { OP_RUNTIME_IMPORTS_RETRY } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { Task } from '../model/Task';
import type { TaskPort } from '../public';

export class RetryTask {
  constructor(private readonly port: Pick<TaskPort, 'retry'>) {}

  execute(context: ConsoleContext, task: Task, reason: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_RUNTIME_IMPORTS_RETRY);
    if (task.type !== 'import' || !task.retryable) throw new Error('TASK_NOT_RETRYABLE');
    if (reason.trim().length < 2) throw new Error('TASK_REASON_REQUIRED');
    return this.port.retry(context, task, reason.trim(), identity, signal);
  }
}
