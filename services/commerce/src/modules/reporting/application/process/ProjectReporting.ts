import type { Cache } from '../../../../foundation/cache/Cache';
import { VersionedKey } from '../../../../foundation/cache/VersionedKey';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { ReportingJobRepository } from '../port/ReportingJobRepository';

export interface ReportingProjectionExecution {
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class ProjectReporting {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: ReportingJobRepository,
    private readonly cache: Cache
  ) {}

  async execute(event: string, execution: ReportingProjectionExecution): Promise<void> {
    const projected = await this.transactions.write(
      {
        tenant: execution.scope,
        membership: '',
        scope: execution.scope,
        actor: 'job:projection',
        trace: execution.trace,
        operation: 'job.reporting.projection',
        workload: 'jobs',
        signal: execution.signal,
        deadline: execution.deadline,
      },
      (context) => this.repository.project(context, event)
    );
    const keys = projected.filter(({ version }) => version > 1).flatMap(({ scope, version }) => cacheKeys(scope, version - 1));
    if (keys.length > 0) await this.cache.remove(...keys);
  }
}

function cacheKeys(scope: string, projectionVersion: number): readonly string[] {
  const metrics = ['dashboard', 'sales', 'product', 'mall', 'category', 'channel', 'powderclass', 'voucher'] as const;
  const periods = ['realtime', 'yesterday', '7days', '30days'] as const;
  return metrics.flatMap((metric) => periods.map((period) => VersionedKey.create('reporting', { scope, metric, period, projectionversion: projectionVersion })));
}
