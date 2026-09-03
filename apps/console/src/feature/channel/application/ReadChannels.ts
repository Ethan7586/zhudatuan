import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { channelOperations, type ChannelView } from '../model/Channel';
import type { ChannelPort } from '../public';

export class ReadChannels {
  constructor(private readonly port: ChannelPort) {}
  execute(context: ConsoleContext, view: ChannelView, cursor?: string, signal?: AbortSignal) {
    assertOperationAccess(context, view === 'connections' ? channelOperations.readConnections : view === 'syncs' ? channelOperations.readSyncs : channelOperations.readOperations);
    return this.port.read(context, view, cursor, signal);
  }
}
