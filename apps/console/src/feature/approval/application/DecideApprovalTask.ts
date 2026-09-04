import { OP_APPROVAL_TASKS_APPROVE, OP_APPROVAL_TASKS_REJECT } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ApprovalTaskCommand } from '../model/Approval';
import type { ApprovalPort } from '../public';
import { assertApprovalCommand } from './ApprovalGuard';

export class DecideApprovalTask {
  constructor(private readonly port: Pick<ApprovalPort, 'execute'>) {}

  execute(context: ConsoleContext, command: ApprovalTaskCommand, identity: string, signal?: AbortSignal) {
    assertApprovalCommand(context, command.kind === 'approve' ? OP_APPROVAL_TASKS_APPROVE : OP_APPROVAL_TASKS_REJECT, identity);
    return this.port.execute(context, command, identity, signal);
  }
}
