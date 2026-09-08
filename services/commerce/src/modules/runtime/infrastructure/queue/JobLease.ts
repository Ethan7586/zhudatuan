import { randomUUID } from 'node:crypto';
import type { DatabasePool } from '../../../../platform/database/Pool';
import type { LeasePort, LeaseRequest, RuntimeLease } from '../../public/LeasePort';

interface LeaseRow {
  readonly resource: string;
  readonly scope: string;
  readonly owner: string;
  readonly token: string;
  readonly deadline: Date | string;
  readonly version: number;
  readonly fencingToken: number;
}

export class JobLease implements LeasePort {
  constructor(private readonly pool: DatabasePool) {}

  async acquire(request: LeaseRequest): Promise<RuntimeLease | null> {
    validateRequest(request);
    const token = `lease:${randomUUID()}`;
    const result = await this.pool.query<LeaseRow>(
      `insert into runtime.leases(resource,tenant_id,scope_id,owner,token,fencing_token,acquired_at,heartbeat_at,deadline,version)
      values($1,$2,$2,$3,$4,1,clock_timestamp(),clock_timestamp(),clock_timestamp()+make_interval(secs=>$5),1)
      on conflict(resource) do update set owner=excluded.owner,token=excluded.token,acquired_at=excluded.acquired_at,
        tenant_id=excluded.tenant_id,scope_id=excluded.scope_id,heartbeat_at=excluded.heartbeat_at,deadline=excluded.deadline,
        fencing_token=runtime.leases.fencing_token+1,version=runtime.leases.version+1 where runtime.leases.deadline<=clock_timestamp()
      returning resource,scope_id scope,owner,token,deadline,version,fencing_token "fencingToken"`,
      [request.resource, request.scope, request.owner, token, request.seconds]
    );
    return result.rows[0] ? projection(result.rows[0]) : null;
  }

  async renew(lease: RuntimeLease, seconds: number): Promise<RuntimeLease> {
    validateLease(lease);
    validateSeconds(seconds);
    const result = await this.pool.query<LeaseRow>(
      `update runtime.leases set heartbeat_at=clock_timestamp(),deadline=clock_timestamp()+make_interval(secs=>$6),version=version+1
      where resource=$1 and scope_id=$2 and owner=$3 and token=$4 and version=$5 and fencing_token=$7 and deadline>clock_timestamp()
      returning resource,scope_id scope,owner,token,deadline,version,fencing_token "fencingToken"`,
      [lease.resource, lease.scope, lease.owner, lease.token, lease.version, seconds, lease.fencingToken]
    );
    if (!result.rows[0]) throw new Error('LEASE_LOST');
    return projection(result.rows[0]);
  }

  async assert(lease: RuntimeLease): Promise<void> {
    validateLease(lease);
    const result = await this.pool.query(
      `select 1 from runtime.leases where resource=$1 and scope_id=$2 and owner=$3 and token=$4 and version=$5 and fencing_token=$6
      and deadline>clock_timestamp()`,
      [lease.resource, lease.scope, lease.owner, lease.token, lease.version, lease.fencingToken]
    );
    if (!result.rows[0]) throw new Error('LEASE_LOST');
  }

  async release(lease: RuntimeLease): Promise<void> {
    validateLease(lease);
    const result = await this.pool.query('delete from runtime.leases where resource=$1 and scope_id=$2 and owner=$3 and token=$4 and version=$5 and fencing_token=$6', [
      lease.resource,
      lease.scope,
      lease.owner,
      lease.token,
      lease.version,
      lease.fencingToken,
    ]);
    if (result.rowCount !== 1) throw new Error('LEASE_LOST');
  }
}

function validateRequest(request: LeaseRequest): void {
  if (!validText(request.resource) || !validText(request.scope) || !validText(request.owner)) throw new Error('LEASE_ARGUMENT_INVALID');
  validateSeconds(request.seconds);
}

function validateLease(lease: RuntimeLease): void {
  if (
    !validText(lease.resource) ||
    !validText(lease.scope) ||
    !validText(lease.owner) ||
    !/^lease:[a-f0-9-]{36}$/.test(lease.token) ||
    !Number.isSafeInteger(lease.version) ||
    lease.version < 1 ||
    !Number.isSafeInteger(lease.fencingToken) ||
    lease.fencingToken < 1 ||
    !Number.isFinite(Date.parse(lease.deadline))
  )
    throw new Error('LEASE_ARGUMENT_INVALID');
}

function validateSeconds(seconds: number): void {
  if (!Number.isSafeInteger(seconds) || seconds < 5 || seconds > 900) throw new Error('LEASE_ARGUMENT_INVALID');
}

function validText(value: string): boolean {
  return value.length > 0 && value.length <= 255 && /^[A-Za-z0-9][A-Za-z0-9:._/-]*$/.test(value);
}

function projection(row: LeaseRow): RuntimeLease {
  const lease = Object.freeze({ resource: row.resource, scope: row.scope, owner: row.owner, token: row.token, deadline: new Date(row.deadline).toISOString(), version: Number(row.version), fencingToken: Number(row.fencingToken) });
  validateLease(lease);
  return lease;
}
