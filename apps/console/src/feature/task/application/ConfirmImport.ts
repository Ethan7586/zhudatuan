import { OP_RUNTIME_IMPORTS_CONFIRM } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { Task } from '../model/Task';
import type { TaskPort } from '../public';

export class ConfirmImport {
  constructor(private readonly port: Pick<TaskPort, 'confirm'>) {}

  execute(context: ConsoleContext, task: Task, identity: string, signal?: AbortSignal): Promise<Task> {
    assertOperationAccess(context, OP_RUNTIME_IMPORTS_CONFIRM);
    if (task.type !== 'import' || !task.confirmationRequired || task.previewHash === null) throw new Error('VALIDATION_FAILED');
    return this.port.confirm(context, task, identity, signal);
  }
}
