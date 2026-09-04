import { OP_QUALIFICATION_QUALIFICATIONS_PUBLISH } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { QualificationPublishCommand } from '../model/Qualification';
import type { QualificationPort } from '../public';

export class PublishQualification {
  constructor(private readonly port: Pick<QualificationPort, 'publish'>) {}
  execute(context: ConsoleContext, command: QualificationPublishCommand, signal?: AbortSignal) {
    assertOperationAccess(context, OP_QUALIFICATION_QUALIFICATIONS_PUBLISH, command.proof);
    return this.port.publish(context, command, signal);
  }
}
