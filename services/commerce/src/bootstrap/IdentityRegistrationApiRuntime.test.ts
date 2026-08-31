import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { assertIdentityRegistrationRuntimeCompatibility } from './IdentityRegistrationApiRuntime';

describe('identity registration API runtime', () => {
  it('requires the dedicated writable registration database role and registration relations', async () => {
    const healthy = { current_user: 'zhudatuanidentityapi', writable: true, schema: true, contract: true,
      registration: true, operator_invitation: true, relations: true, functions: true };
    let compatibilityStatement = '';
    const pool = (state: typeof healthy) => ({ query: async (statement: string) => {
      if (statement.includes('deployment.runtime_database_boundary')) return result([databaseBoundary('zhudatuanidentityapi')], 1);
      compatibilityStatement = statement;
      return result([state], 1);
    } }) as unknown as DatabasePool;
    await expect(assertIdentityRegistrationRuntimeCompatibility(pool(healthy))).resolves.toBeUndefined();
    expect(compatibilityStatement).toContain("version='20260829060000'");
    expect(compatibilityStatement).toContain("checksum='b1e238eb8de569b0de9d1d2766620e1f661268d2f9260e646208d4f24715b37a'");
    await expect(assertIdentityRegistrationRuntimeCompatibility(pool({ ...healthy, current_user: 'shopjob' })))
      .rejects.toThrow('IDENTITY_REGISTRATION_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertIdentityRegistrationRuntimeCompatibility(pool({ ...healthy, relations: false })))
      .rejects.toThrow('IDENTITY_REGISTRATION_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertIdentityRegistrationRuntimeCompatibility(pool({ ...healthy, registration: false })))
      .rejects.toThrow('IDENTITY_REGISTRATION_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertIdentityRegistrationRuntimeCompatibility(pool({ ...healthy, operator_invitation: false })))
      .rejects.toThrow('IDENTITY_REGISTRATION_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertIdentityRegistrationRuntimeCompatibility(pool({ ...healthy, functions: false })))
      .rejects.toThrow('IDENTITY_REGISTRATION_RUNTIME_COMPATIBILITY_FAILED');
    const unretired = { query: async (statement: string) => statement.includes('deployment.runtime_database_boundary')
      ? result([{ ...databaseBoundary('zhudatuanidentityapi'), retired_roles_valid: false }], 1)
      : result([healthy], 1) } as unknown as DatabasePool;
    await expect(assertIdentityRegistrationRuntimeCompatibility(unretired))
      .rejects.toThrow('LIVE_DATABASE_BOUNDARY_ASSERTION_FAILED');
  });
});

function databaseBoundary(current_user: string) {
  return {
    current_user, current_database: 'zhudatuan_registration', active_platform_owner_count: 1, migration_head_valid: true,
    retired_roles_valid: true, business_roles_valid: true, runtime_roles_valid: true, boundary_roles_valid: true, retired_membership_count: 0,
    registration_boundary_owner: 'zhudatuanregistrationboundary', migration_boundary_owner: 'zhudatuanregistrationboundary',
    runtime_boundary_owner: 'zhudatuanregistrationboundary', database_owner: 'shopmigration',
  };
}

function result(rows: readonly unknown[], rowCount: number) {
  return { rows, rowCount, command: '', oid: 0, fields: [] };
}
