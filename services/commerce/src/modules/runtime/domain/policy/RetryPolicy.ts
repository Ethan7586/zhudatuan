import type { RuntimeTaskState, RuntimeTaskType } from '../model/Task';

export class RetryPolicy {
  canRetry(type: RuntimeTaskType, state: RuntimeTaskState): boolean {
    return type === 'import' && state === 'failed';
  }
}
