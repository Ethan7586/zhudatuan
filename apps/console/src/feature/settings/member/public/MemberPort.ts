import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { MemberChange, MemberImportSource, MemberImportTask, MemberPage, MemberReceipt } from '../model/Member';

export interface MemberPort {
  read(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<MemberPage>;
  manage(context: ConsoleContext, change: MemberChange, identity: string, signal?: AbortSignal): Promise<MemberReceipt>;
  createImport(context: ConsoleContext, source: MemberImportSource, identity: string, signal?: AbortSignal): Promise<MemberImportTask>;
  createIdentity(): string;
}
