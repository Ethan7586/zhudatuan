import { OP_SUPPORT_CASES_REOPEN } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { SupportPort } from '../public';
import type { Ticket } from '../model/Ticket';

export class ReopenTicket {
  constructor(private readonly gateway: SupportPort) {}
  execute(context: ConsoleContext, ticket: Ticket) {
    assertOperationAccess(context, OP_SUPPORT_CASES_REOPEN);
    if (!context.session.csrf) throw new Error('安全会话已过期，请重新登录。');
    return this.gateway.reopen(context, ticket);
  }
}
