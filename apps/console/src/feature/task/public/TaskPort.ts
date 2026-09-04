import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Task, TaskFilter, TaskPage } from '../model/Task';
import type { ImportDraft, ImportProviderOptions } from '../model/ImportDraft';

export interface TaskPort {
  list(context: ConsoleContext, filter: TaskFilter, signal?: AbortSignal): Promise<TaskPage>;
  read(context: ConsoleContext, type: 'import' | 'export', id: string, signal?: AbortSignal): Promise<Task>;
  createImport(context: ConsoleContext, draft: ImportDraft, identity: string, signal?: AbortSignal): Promise<Task>;
  providers(context: ConsoleContext, signal?: AbortSignal): Promise<ImportProviderOptions>;
  cancel(context: ConsoleContext, task: Task, reason: string, identity: string, signal?: AbortSignal): Promise<Task>;
  confirm(context: ConsoleContext, task: Task, identity: string, signal?: AbortSignal): Promise<Task>;
  retry(context: ConsoleContext, task: Task, reason: string, identity: string, signal?: AbortSignal): Promise<Task>;
}
