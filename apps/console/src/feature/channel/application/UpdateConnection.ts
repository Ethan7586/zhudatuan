import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { channelOperations, type ConnectionDraft } from '../model/Channel';
import type { ChannelPort } from '../public';
export class UpdateConnection { constructor(private readonly port: ChannelPort) {} execute(context: ConsoleContext, connection: string, version: number, draft: ConnectionDraft, proof: string, identity: string, signal?: AbortSignal) { assertOperationAccess(context, channelOperations.update, proof); return this.port.update(context, connection, version, draft, proof, identity, signal); } }
