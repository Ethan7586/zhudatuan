import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { SupportGateway } from '../infrastructure/SupportGateway';
import type { Ticket } from '../model/Ticket';

export class ReopenTicket {
  constructor(private readonly gateway: SupportGateway) {}
  execute(context: ConsoleContext, ticket: Ticket) {
    if (!context.session.permissions.includes('support.case.manage')) throw new Error('当前账号没有重开工单权限。');
    return this.gateway.reopen(context, ticket.id, ticket.version);
  }
}
