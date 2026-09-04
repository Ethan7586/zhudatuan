import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { BudgetExpiryRepository } from '../port/BudgetExpiryRepository';

export class ExpireMarketingBudget {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly budgets: BudgetExpiryRepository
  ) {}

  execute(request: Readonly<{ order: string; scope: string; trace: string; signal: AbortSignal; deadline: number }>): Promise<void> {
    return this.transactions.write(
      {
        tenant: request.scope,
        membership: '',
        scope: request.scope,
        actor: 'job:marketingbudgetexpiry',
        trace: request.trace,
        operation: 'job.marketing.budgetexpiry',
        workload: 'jobs',
        signal: request.signal,
        deadline: request.deadline,
      },
      (context) => this.budgets.expire(context, request.order, new Date())
    );
  }
}
