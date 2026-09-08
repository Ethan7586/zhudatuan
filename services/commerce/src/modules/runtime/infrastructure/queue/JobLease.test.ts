import { describe, expect, it, vi } from 'vitest';
import type { QueryResult } from 'pg';
import type { DatabasePool } from '../../../../platform/database/Pool';
import { result } from '../../../../test/TransactionFixture';
import { JobLease } from './JobLease';

describe('JobLease', () => {
  it('acquires, renews, asserts and releases a tenant-scoped monotonic fence', async () => {
    const calls: Array<Readonly<{ text: string; values?: readonly unknown[] }>> = [];
    const query = vi.fn(async (text: string, values?: readonly unknown[]): Promise<QueryResult> => {
      calls.push({ text, ...(values === undefined ? {} : { values }) });
      if (text.startsWith('insert into runtime.leases')) return result([leaseRow(String(values?.[3]), 1, 1)]);
      if (text.startsWith('update runtime.leases')) return result([leaseRow(String(values?.[3]), 2, 1)]);
      return result([{ accepted: true }]);
    });
    const leases = new JobLease(pool(query));
    const acquired = await leases.acquire({ resource: 'directory:one', scope: 'organization:one', owner: 'worker:one', seconds: 30 });
    expect(acquired).toMatchObject({ resource: 'directory:one', scope: 'organization:one', owner: 'worker:one', version: 1, fencingToken: 1 });
    const renewed = await leases.renew(acquired!, 30);
    expect(renewed).toMatchObject({ version: 2, fencingToken: 1 });
    await leases.assert(renewed);
    await leases.release(renewed);
    expect(calls[0]?.values?.slice(0, 3)).toEqual(['directory:one', 'organization:one', 'worker:one']);
    expect(calls[1]?.text).toContain('fencing_token=$7');
    expect(calls[2]?.text).toContain('version=$5');
    expect(calls[3]?.text).toContain('fencing_token=$6');
  });

  it('returns busy on a live competing lease and rejects stale renew/assert/release operations', async () => {
    const busy = new JobLease(pool(async () => result([])));
    await expect(busy.acquire({ resource: 'directory:one', scope: 'organization:one', owner: 'worker:two', seconds: 30 })).resolves.toBeNull();
    const stale = lease();
    await expect(busy.renew(stale, 30)).rejects.toThrow('LEASE_LOST');
    await expect(busy.assert(stale)).rejects.toThrow('LEASE_LOST');
    await expect(busy.release(stale)).rejects.toThrow('LEASE_LOST');
  });

  it('rejects invalid resource, scope, duration and forged fence inputs before querying', async () => {
    const query = vi.fn(async () => result([]));
    const leases = new JobLease(pool(query));
    await expect(leases.acquire({ resource: '', scope: 'organization:one', owner: 'worker:one', seconds: 30 })).rejects.toThrow('LEASE_ARGUMENT_INVALID');
    await expect(leases.acquire({ resource: 'directory:one', scope: '../scope', owner: 'worker:one', seconds: 901 })).rejects.toThrow('LEASE_ARGUMENT_INVALID');
    await expect(leases.assert({ ...lease(), token: 'forged' })).rejects.toThrow('LEASE_ARGUMENT_INVALID');
    expect(query).not.toHaveBeenCalled();
  });
});

function lease() {
  return Object.freeze({ resource: 'directory:one', scope: 'organization:one', owner: 'worker:one', token: 'lease:11111111-1111-4111-8111-111111111111', deadline: '2099-01-01T00:00:00.000Z', version: 1, fencingToken: 1 });
}

function leaseRow(token: string, version: number, fencingToken: number) {
  return { resource: 'directory:one', scope: 'organization:one', owner: 'worker:one', token, deadline: new Date('2099-01-01T00:00:00.000Z'), version, fencingToken };
}

function pool(query: DatabasePool['query']): DatabasePool {
  const value = { query, workload: () => value } as unknown as DatabasePool;
  return value;
}
