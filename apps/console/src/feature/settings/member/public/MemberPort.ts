import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { MemberChange, MemberImportSource, MemberImportTask, MemberPage, MemberReceipt, RegistrationResetDraft, RegistrationResetReceipt } from '../model/Member';

export interface MemberPort {
  read(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<MemberPage>;
  manage(context: ConsoleContext, change: MemberChange, identity: string, signal?: AbortSignal): Promise<MemberReceipt>;
  resetRegistration(context: ConsoleContext, draft: RegistrationResetDraft, identity: string, signal?: AbortSignal): Promise<RegistrationResetReceipt>;
  createImport(context: ConsoleContext, source: MemberImportSource, identity: string, signal?: AbortSignal): Promise<MemberImportTask>;
  createIdentity(): string;
}
