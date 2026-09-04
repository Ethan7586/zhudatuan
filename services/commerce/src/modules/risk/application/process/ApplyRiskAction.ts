import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import type { ApprovalPort } from '../../../approval/public';
import type { CatalogRiskDecisionPort } from '../../../catalog/public';
import type { RiskWorkRepository } from '../port/RiskWorkRepository';
import type { RiskReplayExecution } from './ReplayRiskPolicy';

export class ApplyRiskAction {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: RiskWorkRepository,
    private readonly approval: ApprovalPort,
    private readonly catalog: CatalogRiskDecisionPort
  ) {}

  apply(id: string, execution: RiskReplayExecution): Promise<void> {
    return this.transactions.write(options(execution, 'job.risk.action'), async (context) => {
      const action = await this.repository.action(context, id);
      if (!action || action.state === 'applied' || action.state === 'rejected' || action.state === 'expired') return;
      if (Date.parse(action.expiresAt) <= Date.now()) throw new Error('RISK_ACTION_EXPIRED');
      if (action.approvalRequired && action.state === 'approvalrequired') {
        if (action.approvalInstance !== null) return;
        const receipt = await this.approval.request(context, {
          scopeId: action.scope,
          requesterId: action.requester,
          subject: {
            kind: 'riskaction', id: action.id, version: action.version,
            snapshot: { decision: action.decision, kind: action.kind, target: action.target, rationale: action.rationale },
          },
          action: `risk.${action.kind}`,
          evidenceHash: action.evidenceHash,
          constraints: { targetModule: action.target.module, targetType: action.target.type, targetId: action.target.id },
          expiresAt: action.expiresAt,
        });
        if (!(await this.repository.bindApproval(context, action.id, action.version, receipt.instanceId))) throw new Error('RISK_ACTION_VERSION_CONFLICT');
        return;
      }
      if (action.state !== 'proposed' && action.state !== 'approved') return;
      if (action.kind === 'requireverification') {
        if (!(await this.repository.applied(context, action.id, action.version))) throw new Error('RISK_ACTION_VERSION_CONFLICT');
        return;
      }
      if (action.kind === 'suggestunlist' && action.target.module === 'catalog') {
        if (action.approvalProof === null) throw new Error('RISK_ACTION_APPROVAL_PROOF_REQUIRED');
        await this.catalog.execute(context, {
          decision: action.decision, scope: action.scope, listing: action.target.id,
          proof: action.approvalProof, action: action.kind, evidenceHash: action.evidenceHash,
        });
        if (!(await this.repository.applied(context, action.id, action.version))) throw new Error('RISK_ACTION_VERSION_CONFLICT');
        return;
      }
      throw new Error('RISK_ACTION_TARGET_UNAVAILABLE');
    });
  }

  async approvalEvent(input: Readonly<{ type: 'approval.instance.approved' | 'approval.instance.rejected'; instance: string; subject: string; subjectVersion: number; action: string; proof: string | null }>, execution: RiskReplayExecution): Promise<void> {
    const approved = await this.transactions.write(options(execution, 'job.risk.approval'), async (context) => {
      if (input.type === 'approval.instance.rejected') {
        await this.repository.reject(context, input.instance, input.subject, input.subjectVersion, input.action);
        return null;
      }
      if (input.proof === null) throw new Error('RISK_ACTION_APPROVAL_PROOF_REQUIRED');
      return this.repository.approve(context, input.instance, input.subject, input.subjectVersion, input.action, input.proof);
    });
    if (approved !== null) await this.apply(approved, execution);
  }
}

function options(execution: RiskReplayExecution, operation: string): TransactionOptions {
  return {
    tenant: execution.scope, membership: '', scope: execution.scope, actor: 'job:riskscan', trace: execution.trace,
    operation, workload: 'jobs', signal: execution.signal, deadline: execution.deadline,
  };
}
