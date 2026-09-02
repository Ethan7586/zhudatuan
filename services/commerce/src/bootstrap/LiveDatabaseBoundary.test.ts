import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { assertIdentityRuntimeDatabaseBoundary, assertLiveDatabaseBoundary, type LiveDatabaseBoundaryState } from './LiveDatabaseBoundary';

const healthy: LiveDatabaseBoundaryState = Object.freeze({
  current_user: 'zhudatuanidentityapi',
  current_database: 'zhudatuan_registration',
  active_platform_owner_count: 1,
  migration_head_valid: true,
  retired_roles_valid: true,
  business_roles_valid: true,
  runtime_roles_valid: true,
  boundary_roles_valid: true,
  retired_membership_count: 0,
  registration_boundary_owner: 'zhudatuanregistrationboundary',
  migration_boundary_owner: 'zhudatuanregistrationboundary',
  runtime_boundary_owner: 'zhudatuanregistrationboundary',
  database_owner: 'shopmigration',
});

describe('live database boundary', () => {
  it('accepts the exact runtime principal and post-retirement database state', async () => {
    await expect(assertLiveDatabaseBoundary(pool(healthy), 'zhudatuanidentityapi')).resolves.toEqual(healthy);
  });

  it('keeps identity delivery independent from migration login state and unrelated business role digests', async () => {
    await expect(assertIdentityRuntimeDatabaseBoundary(pool({
      ...healthy, retired_roles_valid: false, business_roles_valid: false,
    }), 'zhudatuanidentityapi')).resolves.toMatchObject({ retired_roles_valid: false, business_roles_valid: false });
    await expect(assertIdentityRuntimeDatabaseBoundary(pool({ ...healthy, runtime_roles_valid: false }), 'zhudatuanidentityapi'))
      .rejects.toThrow('LIVE_DATABASE_BOUNDARY_ASSERTION_FAILED');
  });

  it.each([
    ['wrong workload role', { current_user: 'shopjob' }],
    ['wrong database', { current_database: 'postgres' }],
    ['missing Owner bootstrap', { active_platform_owner_count: 0 }],
    ['multiple active Owners', { active_platform_owner_count: 2 }],
    ['migration head missing', { migration_head_valid: false }],
    ['retired role still active', { retired_roles_valid: false }],
    ['business role drift', { business_roles_valid: false }],
    ['runtime role drift', { runtime_roles_valid: false }],
    ['compatibility role drift', { boundary_roles_valid: false }],
    ['retired role membership', { retired_membership_count: 1 }],
    ['bootstrap function owner drift', { registration_boundary_owner: 'shopmigration' }],
    ['migration function owner drift', { migration_boundary_owner: 'shopmigration' }],
    ['guard function owner drift', { runtime_boundary_owner: 'shopmigration' }],
    ['database owner drift', { database_owner: 'postgres' }],
  ])('fails closed on %s', async (_case, changed) => {
    await expect(assertLiveDatabaseBoundary(pool({ ...healthy, ...changed }), 'zhudatuanidentityapi'))
      .rejects.toThrow('LIVE_DATABASE_BOUNDARY_ASSERTION_FAILED');
  });

  it('fails closed when the boundary oracle returns no row', async () => {
    await expect(assertLiveDatabaseBoundary(pool(), 'zhudatuanidentityapi'))
      .rejects.toThrow('LIVE_DATABASE_BOUNDARY_ASSERTION_FAILED:null');
  });
});

function pool(state?: LiveDatabaseBoundaryState): DatabasePool {
  return { query: async () => result(state ? [state] : [], state ? 1 : 0) } as unknown as DatabasePool;
}

function result(rows: readonly unknown[], rowCount: number) {
  return { rows, rowCount, command: '', oid: 0, fields: [] };
}
