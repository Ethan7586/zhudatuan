import type { Inbox } from '../../../../foundation/messaging/Inbox';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';

export interface NavigationInvalidator {
  handle(event: Readonly<{ id: string; type: string; scope: string; payload: Readonly<Record<string, unknown>> }>): Promise<boolean>;
}

export interface NavigationInvalidationExecution {
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class InvalidateNavigation {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly inbox: Inbox,
    private readonly invalidator: NavigationInvalidator
  ) {}

  async execute(event: string, type: string, payload: Readonly<Record<string, unknown>>, execution: NavigationInvalidationExecution): Promise<void> {
    const accepted = await this.invalidator.handle({ id: event, type, scope: execution.scope, payload });
    if (!accepted) throw new Error('NAVIGATION_CACHE_INVALIDATION_FAILED');
    await this.transactions.write(
      {
        tenant: execution.scope,
        membership: '',
        scope: execution.scope,
        actor: 'job:navigation',
        trace: execution.trace,
        operation: 'job.navigation.invalidate',
        workload: 'jobs',
        signal: execution.signal,
        deadline: execution.deadline,
      },
      (context) => this.inbox.complete(context, 'internal', 'job:navigation', event)
    );
  }
}
