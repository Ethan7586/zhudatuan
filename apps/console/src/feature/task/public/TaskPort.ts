import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ImportKind, ImportTask } from '../model/ImportTask';
export interface TaskPort {
  read(context: ConsoleContext, kind: ImportKind, id: string, signal?: AbortSignal): Promise<ImportTask>;
}
