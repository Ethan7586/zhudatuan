import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface EntitlementInput {
  readonly id: string;
  readonly scope: string;
  readonly capability: string;
  readonly state: 'enabled' | 'disabled';
  readonly quota: number | null;
  readonly expiresAt: unknown;
  readonly expectedVersion: number | null;
}

export class CapabilityPort {
  save(database: OperationDatabase, input: EntitlementInput) {
    return database.query(
      `insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
      values($1,$2,$3,$4,$5,clock_timestamp(),$6,0) on conflict(id) do update set state=excluded.state,quota=excluded.quota,
      expires_at=excluded.expires_at,version=capability.entitlement.version+1 where capability.entitlement.scope_id=$2
      and ($7::bigint is null or capability.entitlement.version=$7) returning *`,
      [input.id, input.scope, input.capability, input.state, input.quota, input.expiresAt, input.expectedVersion]
    );
  }
}
