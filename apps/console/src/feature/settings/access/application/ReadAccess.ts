import { OP_ACCESS_CENTER_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import type { AccessPort } from '../public';

export class ReadAccess {
  constructor(private readonly port: Pick<AccessPort, 'read'>) {}
  execute(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    if (!canUseOperation(context, OP_ACCESS_CENTER_READ)) throw new Error('OPERATION_ACCESS_DENIED');
    return this.port.read(context, cursor, signal);
  }
}
