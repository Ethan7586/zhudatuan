import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { QualificationEvidence, type PreparedEvidenceUpload } from '../service/QualificationEvidence';

type Reply = OperationReply<OperationOutputFor<'qualification.evidenceuploads.create'>>;

export class EvidenceUploadsCreateHandler implements DurableOperationHandler<'qualification.evidenceuploads.create', PreparedEvidenceUpload, Reply, 'write'> {
  readonly operation = 'qualification.evidenceuploads.create' as const;
  readonly mode = 'write' as const;

  constructor(private readonly evidence: QualificationEvidence) {}

  prepare(input: OperationInputFor<'qualification.evidenceuploads.create'>, context: PrepareContext<'qualification.evidenceuploads.create'>) {
    return this.evidence.authorize(input, requireSession(context.security).scope.id);
  }

  commit(
    _input: OperationInputFor<'qualification.evidenceuploads.create'>,
    prepared: PreparedEvidenceUpload,
    _context: CommitContext<'qualification.evidenceuploads.create'>
  ): Promise<DurableCommit<Reply, OperationOutputFor<'qualification.evidenceuploads.create'>>> {
    const response = Object.freeze({
      status: 201 as const,
      body: { evidenceId: prepared.evidenceId, kind: prepared.kind, objectId: prepared.objectId, sha256: prepared.sha256, upload: prepared.upload },
    });
    return Promise.resolve({ checkpoint: response, response });
  }

  finalize(_input: OperationInputFor<'qualification.evidenceuploads.create'>, checkpoint: Reply, _context: FinalizeContext<'qualification.evidenceuploads.create'>): Promise<Reply> {
    return Promise.resolve(checkpoint);
  }
}
