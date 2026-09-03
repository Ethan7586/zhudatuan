import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ChannelPage, ChannelView, ConnectionDraft, SyncDraft } from '../model/Channel';

export interface ChannelPort {
  read(context: ConsoleContext, view: ChannelView, cursor?: string, signal?: AbortSignal): Promise<ChannelPage>;
  create(context: ConsoleContext, draft: ConnectionDraft, proof: string, identity: string, signal?: AbortSignal): Promise<void>;
  update(context: ConsoleContext, connection: string, version: number, draft: ConnectionDraft, proof: string, identity: string, signal?: AbortSignal): Promise<void>;
  test(context: ConsoleContext, connection: string, version: number, proof: string, identity: string, signal?: AbortSignal): Promise<void>;
  enable(context: ConsoleContext, connection: string, version: number, proof: string, identity: string, signal?: AbortSignal): Promise<void>;
  disable(context: ConsoleContext, connection: string, version: number, proof: string, identity: string, signal?: AbortSignal): Promise<void>;
  startSync(context: ConsoleContext, draft: SyncDraft, identity: string, signal?: AbortSignal): Promise<void>;
  cancelSync(context: ConsoleContext, sync: string, version: number, identity: string, signal?: AbortSignal): Promise<void>;
  replay(context: ConsoleContext, operation: string, proof: string, identity: string, signal?: AbortSignal): Promise<void>;
}
