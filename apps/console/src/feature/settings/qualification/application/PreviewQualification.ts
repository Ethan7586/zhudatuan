import { OP_QUALIFICATION_DECISIONS_PREVIEW } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { PolicyPreviewCommand } from '../model/Command';
import type { QualificationPort } from '../public';

export class PreviewQualification {
  constructor(private readonly port: Pick<QualificationPort, 'previewPolicy' | 'previewDecision'>) {}
  policy(context: ConsoleContext, command: PolicyPreviewCommand, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_QUALIFICATION_DECISIONS_PREVIEW);
    return this.port.previewPolicy(context, command, identity, signal);
  }
  decision(context: ConsoleContext, member: string, resource: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_QUALIFICATION_DECISIONS_PREVIEW);
    return this.port.previewDecision(context, member, resource, identity, signal);
  }
}
