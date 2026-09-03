import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { SupportPort } from '../public';
import type { Ticket } from '../model/Ticket';

export class AssignTicket {
  constructor(private readonly gateway: SupportPort) {}
  execute(context: ConsoleContext, ticket: Ticket, agent: string, reason: string) {
    if (!context.session.permissions.includes('support.assignment.manage')) throw new Error('当前账号没有转派权限。');
    if (!agent || reason.trim().length < 4) throw new Error('请选择客服并填写转派原因。');
    return this.gateway.assign(context, ticket, agent, reason.trim());
  }
}
