import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { OwnershipRepository } from '../port/OwnershipRepository';

export interface OwnershipExpiryRequest {
  readonly job: string;
  readonly scope: string;
  readonly transfer: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class ExpireOwnershipTransfer {
  constructor(private readonly transactions: TransactionManager, private readonly repository: Pick<OwnershipRepository, 'expire'>) {}

  async execute(request: OwnershipExpiryRequest): Promise<void> {
    if (request.signal.aborted) throw request.signal.reason ?? new Error('JOB_ABORTED');
    await this.transactions.write(
      {
        tenant: request.scope,
        membership: '',
        scope: request.scope,
        actor: 'job:ownershipexpiry',
        trace: request.trace,
        operation: 'job.access.ownershipexpiry',
        workload: 'jobs',
        signal: request.signal,
        deadline: request.deadline,
      },
      (context) => this.repository.expire(context, request.scope, request.transfer, request.trace)
    );
  }
}
