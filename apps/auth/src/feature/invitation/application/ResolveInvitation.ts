import type { InvitationPort } from '../public/InvitationPort';
import type { InvitationResolution } from '../model/Invitation';

export class ResolveInvitation {
  constructor(private readonly port: InvitationPort) {}
  execute(input: InvitationResolution) { return this.port.resolve(input); }
}
