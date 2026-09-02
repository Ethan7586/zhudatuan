import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { SupportJobRepository } from '../port/SupportJobRepository';
import type { SupportJobExecution } from './RunSupportJob';

export class EvaluateSla {
  constructor(private readonly transactions: TransactionManager, private readonly repository: SupportJobRepository) {}
  execute(ticket: string, reason: 'response' | 'resolution', execution: SupportJobExecution): Promise<void> {
    return this.transactions.write(options(execution), (context) => this.repository.escalate(context, ticket, reason));
  }
}

function options(execution: SupportJobExecution) {
  return { tenant: execution.scope, membership: '', scope: execution.scope, actor: 'job:supportsla', trace: execution.trace, operation: 'job.support.supportsla', workload: 'jobs' as const, signal: execution.signal, deadline: execution.deadline };
}
