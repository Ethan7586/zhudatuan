import { OP_SUPPORT_READSTATES_MANAGE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { SupportPort } from '../public';

export class UpdateReadState {
  constructor(private readonly gateway: SupportPort) {}
  execute(context: ConsoleContext, conversation: string, sequence: number) {
    assertOperationAccess(context, OP_SUPPORT_READSTATES_MANAGE);
    if (!context.session.csrf) throw new Error('安全会话已过期，请重新登录。');
    return this.gateway.updateRead(context, conversation, sequence);
  }
}
