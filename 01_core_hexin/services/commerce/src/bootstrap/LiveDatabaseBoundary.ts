import type { DatabasePool } from '../foundation/persistence/Pool';

export type RuntimeDatabaseRole = 'shopjob' | 'zhudatuanidentityapi' | 'zhudatuanidentityjob';

export interface LiveDatabaseBoundaryState {
  readonly current_user: string;
  readonly current_database: string;
  readonly active_platform_owner_count: number;
  readonly migration_head_valid: boolean;
  readonly retired_roles_valid: boolean;
  readonly business_roles_valid: boolean;
  readonly runtime_roles_valid: boolean;
  readonly boundary_roles_valid: boolean;
  readonly retired_membership_count: number;
  readonly registration_boundary_owner: string | null;
  readonly migration_boundary_owner: string | null;
  readonly runtime_boundary_owner: string | null;
  readonly database_owner: string | null;
}

interface BoundaryRequirements {
  readonly businessRoles: boolean;
  readonly retiredRoles: boolean;
}

const BOUNDARY_OWNER = 'zhudatuanregistrationboundary';

export async function assertLiveDatabaseBoundary(
  pool: DatabasePool,
  expectedRole: RuntimeDatabaseRole,
): Promise<Readonly<LiveDatabaseBoundaryState>> {
  return assertBoundary(pool, expectedRole, { businessRoles: true, retiredRoles: true });
}

export async function assertIdentityRuntimeDatabaseBoundary(
  pool: DatabasePool,
  expectedRole: Extract<RuntimeDatabaseRole, 'zhudatuanidentityapi' | 'zhudatuanidentityjob'>,
): Promise<Readonly<LiveDatabaseBoundaryState>> {
  // Identity runtimes own neither the Web/Purchase role digest nor the
  // serialized migration role lifecycle. Identity, ownership and database
  // invariants below remain mandatory.
  return assertBoundary(pool, expectedRole, { businessRoles: false, retiredRoles: false });
}

async function assertBoundary(pool: DatabasePool, expectedRole: RuntimeDatabaseRole, requirements: BoundaryRequirements) {
  const result = await pool.query<LiveDatabaseBoundaryState>(`select current_user,current_database(),boundary.*
    from deployment.runtime_database_boundary() boundary`);
  const state = result.rows[0];
  if (!state
    || state.current_user !== expectedRole
    || state.current_database !== 'zhudatuan_registration'
    || state.active_platform_owner_count !== 1
    || !state.migration_head_valid
    || (requirements.retiredRoles && !state.retired_roles_valid)
    || (requirements.businessRoles && !state.business_roles_valid)
    || !state.runtime_roles_valid
    || !state.boundary_roles_valid
    || state.retired_membership_count !== 0
    || state.registration_boundary_owner !== BOUNDARY_OWNER
    || state.migration_boundary_owner !== BOUNDARY_OWNER
    || state.runtime_boundary_owner !== BOUNDARY_OWNER
    || state.database_owner !== 'shopmigration') {
    throw new Error(`LIVE_DATABASE_BOUNDARY_ASSERTION_FAILED:${JSON.stringify(state ?? null)}`);
  }
  return Object.freeze({ ...state });
}
