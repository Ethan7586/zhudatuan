import { OP_APPROVAL_TASKS_LIST, OP_APPROVAL_TEMPLATES_GET, OP_APPROVAL_TEMPLATES_LIST } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { ApprovalPort, ApprovalReadRequest } from '../public';

export class ReadApprovals {
  constructor(private readonly port: Pick<ApprovalPort, 'read'>) {}

  execute(context: ConsoleContext, request: ApprovalReadRequest, signal?: AbortSignal) {
    const operation = request.kind === 'template' ? OP_APPROVAL_TEMPLATES_GET : request.kind === 'tasks' ? OP_APPROVAL_TASKS_LIST : OP_APPROVAL_TEMPLATES_LIST;
    assertOperationAccess(context, operation);
    return this.port.read(context, request, signal);
  }
}
