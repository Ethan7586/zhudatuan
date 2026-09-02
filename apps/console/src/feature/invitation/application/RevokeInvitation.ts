import { createIdempotencyKey } from '@shop/sdk/context';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { InvitationGateway } from '../infrastructure/InvitationGateway';
import type { Invitation } from '../model/Invitation';

export class RevokeInvitation {
  constructor(private readonly gateway: InvitationGateway) {}
  execute(context: ConsoleContext, invitation: Invitation, reason: string, signal?: AbortSignal) {
    return this.gateway.revoke(context, invitation.id, invitation.version, reason, createIdempotencyKey(), signal);
  }
}
