import { OP_QUALIFICATION_POLICIES_MANAGE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { PolicyManageCommand } from '../model/Command';
import type { QualificationPort } from '../public';

export class ManageQualification {
  constructor(private readonly port: Pick<QualificationPort, 'manage'>) {}
  execute(context: ConsoleContext, command: PolicyManageCommand, signal?: AbortSignal) {
    assertOperationAccess(context, OP_QUALIFICATION_POLICIES_MANAGE, command.proof);
    return this.port.manage(context, command, signal);
  }
}
