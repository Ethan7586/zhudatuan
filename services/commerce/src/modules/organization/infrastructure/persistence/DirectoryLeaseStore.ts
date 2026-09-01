import { LeaseStore } from '../../../../foundation/infrastructure/LeaseStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { DirectoryLease } from '../../application/port/DirectoryJobRepository';

export class DirectoryLeaseStore implements DirectoryLease {
  private readonly leases: LeaseStore;

  constructor(pool: DatabasePool) {
    this.leases = new LeaseStore(pool);
  }

  async run(resource: string, owner: string, seconds: number, work: (assertLease: () => Promise<void>) => Promise<void>): Promise<void> {
    const lease = await this.leases.acquire(resource, owner, seconds);
    if (!lease) throw new Error(resource === 'directory:reconcile' ? 'DIRECTORY_RECONCILE_LEASE_BUSY' : 'DIRECTORY_SYNC_LEASE_BUSY');
    try {
      await work(() => this.leases.assert(lease));
    } finally {
      await this.leases.release(lease).catch((cause: unknown) => {
        if (!(cause instanceof Error) || cause.message !== 'LEASE_LOST') throw cause;
      });
    }
  }
}
