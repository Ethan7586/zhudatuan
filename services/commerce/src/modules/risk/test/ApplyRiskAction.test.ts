import { describe, expect, it, vi } from 'vitest';
import type { TransactionManager } from '../../../platform/database/TransactionManager';
import type { ApprovalPort } from '../../approval/public';
import type { CatalogRiskDecisionPort } from '../../catalog/public';
import { ApplyQualificationRisk } from '../application/process/ApplyQualificationRisk';
import { ApplyRiskAction } from '../application/process/ApplyRiskAction';
import type { RiskActionRecord, RiskWorkRepository } from '../application/port/RiskWorkRepository';

const context = Object.freeze({ mode: 'write' }) as never;
const execution = () => ({ scope: 'mall:one', trace: 'trace:one', signal: new AbortController().signal, deadline: Date.now() + 1_000 });
const transactions = { write: vi.fn(async (_options, operation) => operation(context)) } as unknown as TransactionManager;

function action(value: Partial<RiskActionRecord> = {}): RiskActionRecord {
  return Object.freeze({
    id: 'riskaction:one',
    decision: 'riskdecision:one',
    scope: 'mall:one',
    kind: 'suggestunlist',
    target: Object.freeze({ module: 'catalog', type: 'resource', id: 'listing:one' }),
    rationale: 'risk.deny.catalog',
    approvalRequired: true,
    approvalInstance: null,
    approvalProof: null,
    evidenceHash: 'a'.repeat(64),
    state: 'approvalrequired',
    version: 1,
    requester: 'member:one',
    expiresAt: '2099-01-01T00:00:00.000Z',
    ...value,
  });
}

describe('ApplyRiskAction', () => {
  it('routes high-impact action requests through Approval before touching the target', async () => {
    const bindApproval = vi.fn().mockResolvedValue(true);
    const repository = { action: vi.fn().mockResolvedValue(action()), bindApproval } as unknown as RiskWorkRepository;
    const request = vi.fn().mockResolvedValue({ instanceId: 'approval:one', state: 'pending', templateId: 'template:one', templateVersion: 1, version: 1, requestedAt: '2026-09-06T00:00:00Z' });
    const catalog = { execute: vi.fn() } as unknown as CatalogRiskDecisionPort;
    await new ApplyRiskAction(transactions, repository, { request } as unknown as ApprovalPort, catalog).apply('riskaction:one', execution());
    expect(request).toHaveBeenCalledWith(context, expect.objectContaining({ subject: expect.objectContaining({ kind: 'riskaction', id: 'riskaction:one' }), action: 'risk.suggestunlist' }));
    expect(bindApproval).toHaveBeenCalledWith(context, 'riskaction:one', 1, 'approval:one');
    expect(catalog.execute).not.toHaveBeenCalled();
  });

  it('applies an approved catalog request exactly once and records completion', async () => {
    const approved = action({ approvalInstance: 'approval:one', approvalProof: 'proof:one', state: 'approved', version: 2 });
    const applied = vi.fn().mockResolvedValue(true);
    const repository = { action: vi.fn().mockResolvedValue(approved), applied } as unknown as RiskWorkRepository;
    const execute = vi.fn().mockResolvedValue(undefined);
    await new ApplyRiskAction(transactions, repository, {} as ApprovalPort, { execute } as unknown as CatalogRiskDecisionPort).apply(approved.id, execution());
    expect(execute).toHaveBeenCalledWith(context, {
      decision: approved.decision,
      scope: approved.scope,
      listing: approved.target.id,
      proof: approved.approvalProof,
      action: 'suggestunlist',
      evidenceHash: approved.evidenceHash,
    });
    expect(applied).toHaveBeenCalledWith(context, approved.id, approved.version);
  });

  it('never republishes listings when qualification becomes valid again', async () => {
    const qualification = vi.fn().mockResolvedValue(1);
    const process = new ApplyQualificationRisk(transactions, { qualification } as unknown as CatalogRiskDecisionPort);
    const base = { event: 'event:one', type: 'qualification.changed' as const, qualification: 'qualification:one', subjectKind: 'product', subjectId: 'product:one', productIds: ['product:one'], categoryIds: [], regionIds: [] };
    await process.apply({ ...base, state: 'published' }, execution());
    expect(qualification).not.toHaveBeenCalled();
    await process.apply({ ...base, type: 'qualification.revoked', state: 'revoked' }, execution());
    expect(qualification).toHaveBeenCalledOnce();
  });
});
