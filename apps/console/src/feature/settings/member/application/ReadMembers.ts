import { OP_MEMBER_MEMBERS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import type { MemberPort } from '../public';

export class ReadMembers {
  constructor(private readonly port: Pick<MemberPort, 'read'>) {}
  execute(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    if (!canUseOperation(context, OP_MEMBER_MEMBERS_READ)) throw new Error('OPERATION_ACCESS_DENIED');
    return this.port.read(context, cursor, signal);
  }
}
