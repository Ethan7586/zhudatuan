import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { channelOperations } from '../model/Channel';
import type { ChannelPort } from '../public';
export class TestConnection {
  constructor(private readonly port: ChannelPort) {}
  execute(context: ConsoleContext, connection: string, version: number, proof: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, channelOperations.test, proof);
    return this.port.test(context, connection, version, proof, identity, signal);
  }
}
