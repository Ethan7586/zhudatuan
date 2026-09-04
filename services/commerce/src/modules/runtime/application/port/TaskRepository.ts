import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { RuntimeTask, RuntimeTaskState, RuntimeTaskType } from '../../domain/model/Task';

export interface TaskQuery {
  readonly scope: string;
  readonly actor: string;
  readonly type: RuntimeTaskType | null;
  readonly state: RuntimeTaskState | null;
  readonly owner: string | null;
  readonly cursorTime: string | null;
  readonly cursorId: string | null;
  readonly fetch: number;
}

export interface TaskMutation {
  readonly id: string;
  readonly scope: string;
  readonly actor: string;
  readonly expectedVersion: number;
  readonly reason: string;
}

export interface TaskConfirmation extends TaskMutation {
  readonly previewHash: string;
}

export interface TaskRepository {
  list(context: ReadTransactionContext, query: TaskQuery): Promise<readonly RuntimeTask[]>;
  read(context: ReadTransactionContext, id: string, scope: string, actor: string): Promise<RuntimeTask | null>;
  cancel(context: WriteTransactionContext, input: TaskMutation): Promise<RuntimeTask | null>;
  confirmImport(context: WriteTransactionContext, input: TaskConfirmation): Promise<RuntimeTask | null>;
  retryImport(context: WriteTransactionContext, input: TaskMutation): Promise<RuntimeTask | null>;
}
