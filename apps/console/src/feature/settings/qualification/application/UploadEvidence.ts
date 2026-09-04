import { OP_QUALIFICATION_EVIDENCEUPLOADS_CREATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { EvidenceKind } from '../model/Qualification';
import type { QualificationPort } from '../public';

export class UploadEvidence {
  constructor(private readonly port: Pick<QualificationPort, 'upload'>) {}
  execute(context: ConsoleContext, file: File, kind: EvidenceKind, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_QUALIFICATION_EVIDENCEUPLOADS_CREATE);
    return this.port.upload(context, file, kind, identity, signal);
  }
}
