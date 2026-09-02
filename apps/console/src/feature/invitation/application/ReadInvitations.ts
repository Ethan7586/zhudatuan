import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { InvitationGateway } from '../infrastructure/InvitationGateway';
import type { InvitationFilter } from '../model/Invitation';

export const invitationKey = (context: ConsoleContext, filter: InvitationFilter) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'identity.invitations.read', filter] as const);

export class ReadInvitations {
  constructor(private readonly gateway: InvitationGateway) {}
  execute(context: ConsoleContext, filter: InvitationFilter, signal: AbortSignal) {
    return this.gateway.read(context, filter, signal);
  }
}
