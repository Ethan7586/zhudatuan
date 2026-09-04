import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { MallCreateDraft, MallParentPage, MallRecord, MallUpdateDraft } from '../model/Mall';

export interface MallPort {
  parents(context: ConsoleContext, signal?: AbortSignal): Promise<MallParentPage>;
  create(context: ConsoleContext, draft: MallCreateDraft, identity: string, signal?: AbortSignal): Promise<MallRecord>;
  read(context: ConsoleContext, mall: string, signal?: AbortSignal): Promise<MallRecord>;
  update(context: ConsoleContext, mall: string, version: number, draft: MallUpdateDraft, identity: string, signal?: AbortSignal): Promise<MallRecord>;
}
