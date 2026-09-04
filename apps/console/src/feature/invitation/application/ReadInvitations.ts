import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { InvitationFilter } from '../model/Invitation';
import type { InvitationPort } from '../public';

export class ReadInvitations {
  constructor(private readonly port: Pick<InvitationPort, 'read'>) {}
  execute(context: ConsoleContext, filter: InvitationFilter, signal?: AbortSignal) {
    return this.port.read(context, filter, signal);
  }
}
