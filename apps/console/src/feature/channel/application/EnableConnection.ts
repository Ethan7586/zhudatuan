import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { channelOperations } from '../model/Channel';
import type { ChannelPort } from '../public';
export class EnableConnection { constructor(private readonly port: ChannelPort) {} execute(context: ConsoleContext, connection: string, version: number, proof: string, identity: string, signal?: AbortSignal) { assertOperationAccess(context, channelOperations.enable, proof); return this.port.enable(context, connection, version, proof, identity, signal); } }
