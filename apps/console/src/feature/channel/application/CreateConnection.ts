import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { channelOperations, type ConnectionDraft } from '../model/Channel';
import type { ChannelPort } from '../public';
export class CreateConnection {
  constructor(private readonly port: ChannelPort) {}
  execute(context: ConsoleContext, draft: ConnectionDraft, proof: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, channelOperations.create, proof);
    return this.port.create(context, draft, proof, identity, signal);
  }
}
