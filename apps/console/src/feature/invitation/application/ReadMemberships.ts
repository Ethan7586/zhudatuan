import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { InvitationPort } from '../public';

export class ReadMemberships {
  constructor(private readonly port: Pick<InvitationPort, 'memberships'>) {}
  execute(context: ConsoleContext, signal?: AbortSignal) {
    return this.port.memberships(context, signal);
  }
}
