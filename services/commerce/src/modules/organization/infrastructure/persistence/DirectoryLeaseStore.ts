import type { LeasePort } from '../../../runtime/public';
import type { DirectoryLease } from '../../application/port/DirectoryJobRepository';

/** Keeps a resource fence alive and exposes an explicit pre-write assertion to the domain process. */
export class DirectoryLeaseStore implements DirectoryLease {
  constructor(private readonly leases: LeasePort) {}

  async run(scope: string, resource: string, owner: string, seconds: number, work: (assertLease: () => Promise<void>) => Promise<void>): Promise<void> {
    const acquired = await this.leases.acquire({ scope, resource, owner, seconds });
    if (acquired === null) throw new Error(resource === 'directory:reconcile' ? 'DIRECTORY_RECONCILE_LEASE_BUSY' : 'DIRECTORY_SYNC_LEASE_BUSY');
    let lease = acquired;
    let renewal: Promise<void> = Promise.resolve();
    let lost: unknown;
    const pulse = () => {
      renewal = renewal.then(async () => { if (lost === undefined) lease = await this.leases.renew(lease, seconds); })
        .catch((cause: unknown) => { lost = cause; });
    };
    const timer = setInterval(pulse, Math.max(1_000, seconds * 400));
    const assertLease = async () => {
      await renewal;
      if (lost !== undefined) throw lost;
      await this.leases.assert(lease);
    };
    try {
      await work(assertLease);
      await assertLease();
    } finally {
      clearInterval(timer);
      await renewal;
      await this.leases.release(lease).catch((cause: unknown) => {
        if (!(cause instanceof Error) || cause.message !== 'LEASE_LOST') throw cause;
      });
    }
  }
}
