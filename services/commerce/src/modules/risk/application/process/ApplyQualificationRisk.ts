import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { CatalogRiskDecisionPort } from '../../../catalog/public';
import type { RiskReplayExecution } from './ReplayRiskPolicy';

export interface QualificationRiskInput {
  readonly event: string;
  readonly type: 'qualification.changed' | 'qualification.expired' | 'qualification.revoked';
  readonly qualification: string;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly productIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly regionIds: readonly string[];
  readonly state: string;
}

/** Applies authoritative qualification events; policy replay never calls this process. */
export class ApplyQualificationRisk {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly catalog: CatalogRiskDecisionPort
  ) {}

  apply(input: QualificationRiskInput, execution: RiskReplayExecution): Promise<void> {
    return this.transactions.write(options(execution), async (context) => {
      if (input.state === 'published') return;
      if (!['revoked', 'expired'].includes(input.state)) throw new Error('QUALIFICATION_RISK_STATE_INVALID');
      await this.catalog.qualification(context, {
        event: input.event,
        qualification: input.qualification,
        scope: execution.scope,
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
        productIds: input.productIds,
        categoryIds: input.categoryIds,
        regionIds: input.regionIds,
      });
    });
  }
}

function options(execution: RiskReplayExecution) {
  return {
    tenant: execution.scope,
    membership: '',
    scope: execution.scope,
    actor: 'job:riskscan',
    trace: execution.trace,
    operation: 'job.risk.scan',
    workload: 'jobs' as const,
    signal: execution.signal,
    deadline: execution.deadline,
  };
}
