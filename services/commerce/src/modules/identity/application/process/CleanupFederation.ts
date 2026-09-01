import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { FederationCleanupRepository } from '../port/CleanupRepository';

export interface FederationCleanupRequest {
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class CleanupFederation {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: FederationCleanupRepository
  ) {}

  execute(request: FederationCleanupRequest): Promise<void> {
    return this.transactions.write(
      {
        tenant: request.scope,
        membership: '',
        scope: request.scope,
        actor: 'job:federationcleanup',
        trace: request.trace,
        operation: 'job.identity.federationcleanup',
        workload: 'jobs',
        signal: request.signal,
        deadline: request.deadline,
      },
      (context) => this.repository.expire(context)
    );
  }
}
