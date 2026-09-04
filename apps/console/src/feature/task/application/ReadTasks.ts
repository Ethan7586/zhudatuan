import { OP_RUNTIME_EXPORTS_READ, OP_RUNTIME_IMPORTS_READ, OP_RUNTIME_JOBS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { TaskFilter } from '../model/Task';
import type { TaskPort } from '../public';

export class ReadTasks {
  constructor(private readonly port: Pick<TaskPort, 'list' | 'read'>) {}

  execute(context: ConsoleContext, filter: TaskFilter, signal?: AbortSignal) {
    assertOperationAccess(context, OP_RUNTIME_JOBS_READ);
    return this.port.list(context, filter, signal);
  }

  read(context: ConsoleContext, type: 'import' | 'export', id: string, signal?: AbortSignal) {
    assertOperationAccess(context, type === 'import' ? OP_RUNTIME_IMPORTS_READ : OP_RUNTIME_EXPORTS_READ);
    if (id.trim().length === 0) throw new Error('TASK_REQUIRED');
    return this.port.read(context, type, id, signal);
  }
}
