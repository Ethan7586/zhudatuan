import { randomUUID } from 'node:crypto';
import type { DatabasePool } from '../persistence/Pool';

export interface Lease {
  readonly resource: string;
  readonly owner: string;
  readonly token: string;
  readonly deadline: string;
}

export class LeaseStore {
  constructor(private readonly pool: DatabasePool) {}

  async acquire(resource: string, owner: string, seconds: number): Promise<Lease | null> {
    if (!resource || !owner || !Number.isSafeInteger(seconds) || seconds < 5 || seconds > 900) throw new Error('LEASE_ARGUMENT_INVALID');
    const token = `lease:${randomUUID()}`;
    const result = await this.pool.query<Lease>(`insert into runtime.lease(resource,owner,token,acquired_at,deadline,version)
      values($1,$2,$3,clock_timestamp(),clock_timestamp()+make_interval(secs=>$4),0)
      on conflict(resource) do update set owner=excluded.owner,token=excluded.token,acquired_at=excluded.acquired_at,deadline=excluded.deadline,
        version=runtime.lease.version+1 where runtime.lease.deadline<=clock_timestamp()
      returning resource,owner,token,deadline`, [resource, owner, token, seconds]);
    return result.rows[0] ?? null;
  }

  async renew(lease: Lease, seconds: number): Promise<Lease> {
    if (!Number.isSafeInteger(seconds) || seconds < 5 || seconds > 900) throw new Error('LEASE_ARGUMENT_INVALID');
    const result = await this.pool.query<Lease>(`update runtime.lease set deadline=clock_timestamp()+make_interval(secs=>$4),version=version+1
      where resource=$1 and owner=$2 and token=$3 and deadline>clock_timestamp() returning resource,owner,token,deadline`,
    [lease.resource, lease.owner, lease.token, seconds]);
    if (!result.rows[0]) throw new Error('LEASE_LOST');
    return result.rows[0];
  }

  async release(lease: Lease): Promise<void> {
    await this.pool.query('delete from runtime.lease where resource=$1 and owner=$2 and token=$3', [lease.resource, lease.owner, lease.token]);
  }
}
