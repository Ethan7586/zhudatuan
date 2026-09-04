import { OP_ACCESS_OWNERSHIP_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import type { AccessPort } from '../public';

export class ReadOwnership {
  constructor(private readonly port: Pick<AccessPort, 'readOwnership'>) {}
  execute(context: ConsoleContext, signal?: AbortSignal) {
    if (!canUseOperation(context, OP_ACCESS_OWNERSHIP_READ)) throw new Error('OPERATION_ACCESS_DENIED');
    return this.port.readOwnership(context, signal);
  }
}
