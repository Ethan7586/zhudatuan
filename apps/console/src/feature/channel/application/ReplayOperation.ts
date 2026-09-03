import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { channelOperations } from '../model/Channel';
import type { ChannelPort } from '../public';
export class ReplayOperation { constructor(private readonly port: ChannelPort) {} execute(context: ConsoleContext, operation: string, proof: string, identity: string, signal?: AbortSignal) { assertOperationAccess(context, channelOperations.replay, proof); return this.port.replay(context, operation, proof, identity, signal); } }
