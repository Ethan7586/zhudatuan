import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { DirectoryPage } from '../model/Directory';
import type { DirectoryCommand, SyncReceipt, SyncRunPage } from '../model/SyncRun';

export interface DirectoryPort {
  read(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<DirectoryPage>;
  runs(context: ConsoleContext, directory: string, cursor?: string, signal?: AbortSignal): Promise<SyncRunPage>;
  synchronize(context: ConsoleContext, command: DirectoryCommand, signal?: AbortSignal): Promise<SyncReceipt>;
  createIdentity(): string;
}
