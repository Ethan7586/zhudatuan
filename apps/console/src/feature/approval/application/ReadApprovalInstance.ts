import { OP_APPROVAL_INSTANCES_GET } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { ApprovalPort } from '../public';

export class ReadApprovalInstance {
  constructor(private readonly port: Pick<ApprovalPort, 'readInstance'>) {}

  execute(context: ConsoleContext, instanceId: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_APPROVAL_INSTANCES_GET);
    return this.port.readInstance(context, instanceId, signal);
  }
}
