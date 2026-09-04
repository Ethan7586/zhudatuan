import { PERM_SUPPORT_ASSIGNMENT_MANAGE } from '@shop/authz/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { SupportPort } from '../public';
import type { Ticket } from '../model/Ticket';

export class AssignTicket {
  constructor(private readonly gateway: SupportPort) {}
  execute(context: ConsoleContext, ticket: Ticket, agent: string, reason: string) {
    if (!context.session.permissions.includes(PERM_SUPPORT_ASSIGNMENT_MANAGE)) throw new Error('当前账号没有转派权限。');
    if (!agent || reason.trim().length < 4) throw new Error('请选择客服并填写转派原因。');
    return this.gateway.assign(context, ticket, agent, reason.trim());
  }
}
