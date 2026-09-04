import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { DirectoryJobRepository, DirectoryLease } from '../port/DirectoryJobRepository';

export class ReconcileDirectory {
  constructor(
    private readonly leases: DirectoryLease,
    private readonly transactions: TransactionManager,
    private readonly repository: DirectoryJobRepository,
    private readonly leaseSeconds: number
  ) {}

  execute(trace: string, signal: AbortSignal, deadline: number): Promise<void> {
    return this.leases.run('organization-platform-root', 'directory:reconcile', trace, this.leaseSeconds, async (assertLease) => {
      const options = { tenant: '', membership: '', scope: 'organization', actor: 'job:directoryreconcile', trace, operation: 'job.organization.directoryreconcile', workload: 'jobs' as const, signal, deadline };
      await assertLease();
      const anomalies = await this.transactions.read(options, (context) => this.repository.anomalies(context));
      const date = new Date().toISOString().slice(0, 10);
      await assertLease();
      await this.transactions.write(options, async (context) => {
        for (const anomaly of anomalies) await this.repository.alert(context, anomaly, date);
      });
    });
  }
}
