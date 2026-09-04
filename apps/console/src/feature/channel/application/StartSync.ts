import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { channelOperations, type SyncDraft } from '../model/Channel';
import type { ChannelPort } from '../public';
export class StartSync {
  constructor(private readonly port: ChannelPort) {}
  execute(context: ConsoleContext, draft: SyncDraft, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, channelOperations.startSync);
    return this.port.startSync(context, draft, identity, signal);
  }
}
