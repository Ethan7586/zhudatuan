import type { InvitationGateway } from '../infrastructure/InvitationGateway';
import type { InvitationResolution } from '../model/Invitation';

export class ResolveInvitation {
  constructor(private readonly gateway: InvitationGateway) {}
  execute(input: InvitationResolution) { return this.gateway.resolve(input); }
}
