import type { TransactionManager, TransactionOptions } from '../../../../platform/database/TransactionManager';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { EvaluateRisk } from '../service/EvaluateRisk';
import type { RiskWorkRepository } from '../port/RiskWorkRepository';
import type { RiskRepository } from '../port/RiskCheck';
import type { RiskReplayExecution } from './ReplayRiskPolicy';

export class EvaluateDeferredRisk {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly work: RiskWorkRepository,
    private readonly risks: (context: WriteTransactionContext) => RiskRepository
  ) {}

  execute(id: string, execution: RiskReplayExecution): Promise<void> {
    return this.transactions.write(options(execution), async (context) => {
      const assessment = await this.work.assessment(context, id);
      if (!assessment) return;
      try {
        await new EvaluateRisk(this.risks(context)).check({
          actor: assessment.actor,
          operation: assessment.operation,
          resource: assessment.resource,
          scope: assessment.scope,
          scopes: assessment.scopes,
          trace: assessment.trace,
          amountMinor: assessment.amountMinor,
          signals: assessment.signals,
          risk: assessment.risk,
          mode: 'async',
          deadline: execution.deadline,
          signal: execution.signal,
        });
        await this.work.completeAssessment(context, id, true);
      } catch (cause) {
        await this.work.completeAssessment(context, id, false);
        throw cause;
      }
    });
  }
}

function options(execution: RiskReplayExecution): TransactionOptions {
  return {
    tenant: execution.scope,
    membership: '',
    scope: execution.scope,
    actor: 'job:riskscan',
    trace: execution.trace,
    operation: 'job.risk.assessment',
    workload: 'jobs',
    signal: execution.signal,
    deadline: execution.deadline,
  };
}
