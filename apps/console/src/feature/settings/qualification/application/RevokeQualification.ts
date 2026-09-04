import { OP_QUALIFICATION_QUALIFICATIONS_REVOKE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { QualificationRevokeCommand } from '../model/Qualification';
import type { QualificationPort } from '../public';

export class RevokeQualification {
  constructor(private readonly port: Pick<QualificationPort, 'revoke'>) {}
  execute(context: ConsoleContext, command: QualificationRevokeCommand, signal?: AbortSignal) {
    assertOperationAccess(context, OP_QUALIFICATION_QUALIFICATIONS_REVOKE, command.proof);
    return this.port.revoke(context, command, signal);
  }
}
