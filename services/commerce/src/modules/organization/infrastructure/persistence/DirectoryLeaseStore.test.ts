import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LeasePort, RuntimeLease } from '../../../runtime/public';
import { DirectoryLeaseStore } from './DirectoryLeaseStore';

describe('DirectoryLeaseStore', () => {
  afterEach(() => vi.useRealTimers());

  it('renews the lease in one serialized heartbeat chain and releases the latest version', async () => {
    vi.useFakeTimers();
    let current = lease();
    const leases = {
      acquire: vi.fn(async () => current),
      renew: vi.fn(async () => { current = Object.freeze({ ...current, version: current.version + 1 }); return current; }),
      assert: vi.fn(async (value: RuntimeLease) => { if (value.version !== current.version) throw new Error('LEASE_LOST'); }),
      release: vi.fn(async () => undefined),
    } as LeasePort;
    const store = new DirectoryLeaseStore(leases);
    await store.run('organization:one', 'directory:one', 'worker:one', 5, async (assertLease) => {
      await vi.advanceTimersByTimeAsync(2_100);
      await assertLease();
    });
    expect(leases.renew).toHaveBeenCalledOnce();
    expect(leases.release).toHaveBeenCalledWith(expect.objectContaining({ version: 2 }));
  });

  it('stops work at the next fence when renewal loses ownership', async () => {
    vi.useFakeTimers();
    const leases = {
      acquire: vi.fn(async () => lease()),
      renew: vi.fn(async () => { throw new Error('LEASE_LOST'); }),
      assert: vi.fn(async () => undefined),
      release: vi.fn(async () => { throw new Error('LEASE_LOST'); }),
    } as LeasePort;
    const work = new DirectoryLeaseStore(leases).run('organization:one', 'directory:one', 'worker:one', 5, async (assertLease) => {
      await vi.advanceTimersByTimeAsync(2_100);
      await assertLease();
    });
    await expect(work).rejects.toThrow('LEASE_LOST');
  });
});

function lease(): RuntimeLease {
  return Object.freeze({ resource: 'directory:one', scope: 'organization:one', owner: 'worker:one',
    token: 'lease:11111111-1111-4111-8111-111111111111', deadline: '2099-01-01T00:00:00.000Z', version: 1, fencingToken: 1 });
}
