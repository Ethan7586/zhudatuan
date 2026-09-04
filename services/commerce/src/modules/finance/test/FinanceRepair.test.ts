import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { ApprovalPort, ApprovalReadPort } from '../../approval/public';
import type { ApprovalInstanceRecord } from '../../approval/application/port/ApprovalRepository';
import { RepairApproval } from '../application/service/RepairApproval';
import type { RepairDecisionContext } from '../application/port/RepairRepository';
import type { RepairProposal } from '../domain/model/RepairProposal';
import { RepairPolicy } from '../domain/policy/RepairPolicy';

const now = new Date('2026-09-06T08:00:00.000Z');
const proposal: RepairProposal = Object.freeze({
  scopeId: 'mall:one',
  statementId: 'statement:one',
  sourceHash: 'a'.repeat(64),
  sourceVersion: 3,
  sourceJournalId: 'journal:source',
  sourceJournalHash: 'b'.repeat(64),
  sourceJournalDebitMinor: 1_000,
  entries: Object.freeze([
    Object.freeze({ account: 'expense.goods', debitMinor: 900, creditMinor: 0, currency: 'CNY', memo: '替代借方' }),
    Object.freeze({ account: 'liability.payable', debitMinor: 0, creditMinor: 900, currency: 'CNY', memo: '替代贷方' }),
  ]),
  differences: Object.freeze([
    Object.freeze({ id: 'reconciliationdifference:one', kind: 'statementbalance', expectedMinor: 900, actualMinor: 1_000, deltaMinor: 100, currency: 'CNY' }),
  ]),
  makerId: 'membership:maker',
  reason: '替换错误入账',
});
const transaction = { scope: proposal.scopeId, membership: proposal.makerId } as WriteTransactionContext;

describe('finance repair completion', () => {
  it('keeps preview stateless by signing the complete immutable proposal', () => {
    const policy = new RepairPolicy('k'.repeat(32));
    const preview = policy.preview(proposal, now);
    const restored = policy.verify(preview.previewToken, { scopeId: proposal.scopeId, previewHash: preview.previewHash, makerId: proposal.makerId }, new Date(now.getTime() + 1_000));

    expect(restored).toEqual(proposal);
    expect(restored.entries).toEqual(proposal.entries);
    expect(restored.sourceJournalHash).toBe(proposal.sourceJournalHash);
    const [claims, signature] = preview.previewToken.split('.');
    const changed = `${Buffer.from(JSON.stringify({ kind: 'repair', proposal: { ...proposal, reason: '篡改' }, previewHash: preview.previewHash, expiresAt: preview.expiresAt })).toString('base64url')}.${signature}`;
    expect(() => policy.verify(changed, { scopeId: proposal.scopeId, previewHash: preview.previewHash, makerId: proposal.makerId }, now)).toThrow('FINANCE_REPAIR_HASH_MISMATCH');
    expect(claims).toBeTruthy();
  });

  it('rejects malformed expiry and oversized proposal fields before persistence', () => {
    const policy = new RepairPolicy('k'.repeat(32));
    const preview = policy.preview(proposal, now);
    const claims = Buffer.from(JSON.stringify({ kind: 'repair', proposal, previewHash: preview.previewHash, expiresAt: 'not-a-date' })).toString('base64url');
    const signature = createHmac('sha256', 'k'.repeat(32)).update(`financerepair:v1:${claims}`).digest('base64url');
    const malformed = `${claims}.${signature}`;
    expect(() => policy.verify(malformed, { scopeId: proposal.scopeId, previewHash: preview.previewHash, makerId: proposal.makerId }, now)).toThrow('FINANCE_REPAIR_HASH_MISMATCH');
    expect(() => policy.preview({ ...proposal, reason: 'x'.repeat(1_001) }, now)).toThrow('VALIDATION_FAILED');
  });

  it('binds submit to one Approval instance, source journal and monetary ceiling', async () => {
    const request = vi.fn(async () => ({ instanceId: 'approvalinstance:one', state: 'pending' as const, templateId: 'approvaltemplate:one', templateVersion: 1, version: 1, requestedAt: now.toISOString() }));
    const service = new RepairApproval({ request } as unknown as ApprovalPort, {} as ApprovalReadPort);

    await service.request(transaction, 'reconciliationrepair:one', 'c'.repeat(64), proposal);

    expect(request).toHaveBeenCalledWith(transaction, expect.objectContaining({
      requesterId: proposal.makerId,
      subject: expect.objectContaining({ kind: 'financerepair', id: 'reconciliationrepair:one', version: 1 }),
      action: 'finance.repair.apply',
      evidenceHash: 'c'.repeat(64),
      amountMinor: 1_000,
      currency: 'CNY',
      constraints: expect.objectContaining({ sourceJournalId: proposal.sourceJournalId, sourceJournalHash: proposal.sourceJournalHash }),
    }));
  });

  it('consumes an exact Approval Proof before approved execution', async () => {
    const current = repair();
    const consume = vi.fn(async (_context, _proof, binding) => ({ proofId: 'approvalproof:one', instanceId: current.approvalInstanceId, checkerId: 'membership:checker', binding, issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 60_000).toISOString() }));
    const service = new RepairApproval({ consume } as unknown as ApprovalPort, {} as ApprovalReadPort);

    const authorized = await service.authorize(transaction, current, 'approved', 'p'.repeat(43), 'd'.repeat(64));

    expect(authorized).toEqual({ checkerId: 'membership:checker', proofId: 'approvalproof:one' });
    expect(consume).toHaveBeenCalledWith(transaction, 'p'.repeat(43), expect.objectContaining({
      subjectId: current.id,
      subjectVersion: current.version,
      evidenceHash: current.previewHash,
      consumerOperation: 'finance.reconciliationrepairs.decide',
      requestHash: 'd'.repeat(64),
    }));
  });

  it('accepts rejection only from the bound rejected Approval instance', async () => {
    const current = repair();
    const instance = approvalInstance(current);
    const read = vi.fn(async () => instance);
    const service = new RepairApproval({} as ApprovalPort, { read } as ApprovalReadPort);

    await expect(service.authorize(transaction, current, 'rejected', null, 'e'.repeat(64))).resolves.toEqual({ checkerId: 'membership:checker', proofId: null });
    read.mockResolvedValueOnce({ ...instance, subjectId: 'reconciliationrepair:other' });
    await expect(service.authorize(transaction, current, 'rejected', null, 'e'.repeat(64))).rejects.toThrow('APPROVAL_PROOF_INVALID');
  });
});

function repair(): RepairDecisionContext {
  return Object.freeze({
    id: 'reconciliationrepair:one', scopeId: proposal.scopeId, status: 'submitted', makerId: proposal.makerId, version: 1,
    statementId: proposal.statementId, sourceHash: proposal.sourceHash, sourceVersion: proposal.sourceVersion,
    sourceJournalId: proposal.sourceJournalId, sourceJournalHash: proposal.sourceJournalHash, previewHash: 'c'.repeat(64),
    approvalInstanceId: 'approvalinstance:one', approvalAmountMinor: 1_000,
    sourceReversalJournalId: null, replacementJournalId: null, rollbackJournalId: null,
  });
}

function approvalInstance(repair: RepairDecisionContext): ApprovalInstanceRecord {
  return {
    id: repair.approvalInstanceId, scopeId: repair.scopeId, templateId: 'approvaltemplate:one', templateVersion: 1,
    subjectKind: 'financerepair', subjectId: repair.id, subjectVersion: repair.version, subjectSnapshot: {},
    action: 'finance.repair.apply', evidenceHash: repair.previewHash, amountMinor: repair.approvalAmountMinor, currency: 'CNY',
    constraints: { statementId: repair.statementId, sourceHash: repair.sourceHash, sourceVersion: repair.sourceVersion, sourceJournalId: repair.sourceJournalId, sourceJournalHash: repair.sourceJournalHash },
    requesterId: repair.makerId, state: 'rejected', currentStep: 1, stepCount: 1, version: 2,
    createdAt: now.toISOString(), decidedAt: now.toISOString(), expiresAt: null, tasks: [],
    decisions: [{ id: 'approvaldecision:one', instanceId: repair.approvalInstanceId, taskId: 'approvaltask:one', outcome: 'rejected', reason: '证据不足', actorId: 'membership:checker', evidence: {}, proofId: null, proof: null, decidedAt: now.toISOString() }],
  };
}
