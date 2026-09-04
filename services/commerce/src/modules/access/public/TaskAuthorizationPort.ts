import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface TaskAuthorizationPort {
  assert(context: ReadTransactionContext, evidence: Readonly<Record<string, unknown>>): Promise<void>;
}

export const TASK_AUTHORIZATION_PORT = publicPort<TaskAuthorizationPort>('access', 'taskauthorization');
