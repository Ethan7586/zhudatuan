import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { InventoryReturnPort } from '../../../fulfillment/public';
import type { RestockRepository } from '../port/RestockRepository';

export interface RestockExecution {
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class RestockReturn {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: RestockRepository,
    private readonly returns: InventoryReturnPort
  ) {}

  execute(id: string, execution: RestockExecution): Promise<void> {
    return this.transactions.write(
      {
        tenant: execution.scope,
        membership: '',
        scope: execution.scope,
        actor: 'job:inventorysync',
        trace: execution.trace,
        operation: 'job.inventory.restock',
        workload: 'jobs',
        signal: execution.signal,
        deadline: execution.deadline,
      },
      async (context) => {
        const returned = await this.returns.restock(context, id);
        if (!returned) throw new Error('RETURN_RESTOCK_NOT_RUNNABLE');
        await this.repository.apply(context, { id, scope: returned.scope, location: returned.location, lines: returned.lines });
      }
    );
  }
}
