import { OP_SUPPORT_ASSIGNMENTS_MANAGE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { SupportPort } from '../public';
import type { Ticket } from '../model/Ticket';

export class AssignTicket {
  constructor(private readonly gateway: SupportPort) {}
  execute(context: ConsoleContext, ticket: Ticket, agent: string, reason: string) {
    assertOperationAccess(context, OP_SUPPORT_ASSIGNMENTS_MANAGE);
    if (!context.session.csrf) throw new Error('安全会话已过期，请重新登录。');
    if (!agent || reason.trim().length < 4) throw new Error('请选择客服并填写转派原因。');
    return this.gateway.assign(context, ticket, agent, reason.trim());
  }
}
