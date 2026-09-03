import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { SupportPort } from '../public';
import type { Ticket } from '../model/Ticket';

export class ReopenTicket {
  constructor(private readonly gateway: SupportPort) {}
  execute(context: ConsoleContext, ticket: Ticket) {
    if (!context.session.permissions.includes('support.case.manage')) throw new Error('当前账号没有重开工单权限。');
    return this.gateway.reopen(context, ticket);
  }
}
