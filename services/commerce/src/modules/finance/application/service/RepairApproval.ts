import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ApprovalPort, ApprovalReadPort, ApprovalRequest, ApprovalProofBinding } from '../../../approval/public';
import type { RepairProposal } from '../../domain/model/RepairProposal';
import { repairAmount } from '../../domain/model/RepairProposal';
import type { RepairDecisionContext } from '../port/RepairRepository';
import { digest } from '../../domain/policy/PolicyPreview';

const action = 'finance.repair.apply';
const consumer = 'finance.reconciliationrepairs.decide';

export class RepairApproval {
  constructor(
    private readonly approvals: ApprovalPort,
    private readonly reads: ApprovalReadPort
  ) {}

  request(context: WriteTransactionContext, repairId: string, previewHash: string, proposal: RepairProposal) {
    return this.approvals.request(context, approvalRequest(repairId, previewHash, proposal));
  }

  async authorize(context: WriteTransactionContext, repair: RepairDecisionContext, decision: 'approved' | 'rejected', proof: string | null, requestHash: string): Promise<Readonly<{ checkerId: string; proofId: string | null }>> {
    if (decision === 'approved') {
      if (proof === null) throw new DomainError('APPROVAL_PROOF_INVALID');
      const consumed = await this.approvals.consume(context, proof, binding(repair, requestHash));
      if (consumed.instanceId !== repair.approvalInstanceId) throw new DomainError('APPROVAL_PROOF_INVALID');
      return Object.freeze({ checkerId: consumed.checkerId, proofId: consumed.proofId });
    }
    if (proof !== null) throw new DomainError('APPROVAL_PROOF_INVALID');
    const instance = await this.reads.read(context, repair.scopeId, repair.approvalInstanceId);
    if (
      !instance ||
      instance.state !== 'rejected' ||
      instance.subjectKind !== 'financerepair' ||
      instance.subjectId !== repair.id ||
      instance.subjectVersion !== repair.version ||
      instance.action !== action ||
      instance.evidenceHash !== repair.previewHash ||
      instance.amountMinor !== repair.approvalAmountMinor ||
      instance.currency !== 'CNY' ||
      digest(instance.constraints) !== digest(constraints(repair))
    )
      throw new DomainError('APPROVAL_PROOF_INVALID');
    const rejected = [...instance.decisions].reverse().find((candidate) => candidate.outcome === 'rejected');
    if (!rejected) throw new DomainError('APPROVAL_PROOF_INVALID');
    return Object.freeze({ checkerId: rejected.actorId, proofId: null });
  }
}

function approvalRequest(repairId: string, previewHash: string, proposal: RepairProposal): ApprovalRequest {
  const amountMinor = repairAmount(proposal);
  return Object.freeze({
    scopeId: proposal.scopeId,
    requesterId: proposal.makerId,
    subject: Object.freeze({ kind: 'financerepair', id: repairId, version: 1, snapshot: snapshot(proposal) }),
    action,
    evidenceHash: previewHash,
    amountMinor,
    currency: 'CNY',
    constraints: constraints(proposal),
    expiresAt: null,
  });
}

function binding(repair: RepairDecisionContext, requestHash: string): ApprovalProofBinding {
  return Object.freeze({
    scopeId: repair.scopeId,
    subjectKind: 'financerepair',
    subjectId: repair.id,
    subjectVersion: repair.version,
    action,
    evidenceHash: repair.previewHash,
    amountMinor: repair.approvalAmountMinor,
    currency: 'CNY',
    constraints: constraints(repair),
    consumerOperation: consumer,
    requestHash,
  });
}

function snapshot(proposal: RepairProposal): Readonly<Record<string, unknown>> {
  return Object.freeze({
    statementId: proposal.statementId,
    sourceHash: proposal.sourceHash,
    sourceVersion: proposal.sourceVersion,
    sourceJournalId: proposal.sourceJournalId,
    sourceJournalHash: proposal.sourceJournalHash,
    sourceJournalDebitMinor: proposal.sourceJournalDebitMinor,
    entries: proposal.entries,
    differences: proposal.differences,
    reason: proposal.reason,
  });
}

function constraints(value: Pick<RepairProposal, 'statementId' | 'sourceHash' | 'sourceVersion' | 'sourceJournalId' | 'sourceJournalHash'>): Readonly<Record<string, unknown>> {
  return Object.freeze({
    statementId: value.statementId,
    sourceHash: value.sourceHash,
    sourceVersion: value.sourceVersion,
    sourceJournalId: value.sourceJournalId,
    sourceJournalHash: value.sourceJournalHash,
  });
}
