import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import {
  MALL_PROVISIONING_SCHEMA_CHECKSUM,
  MALL_PROVISIONING_SCHEMA_VERSION,
  assertMallProvisioningRuntimeCompatibility,
} from './MallProvisioningApiRuntime';

describe('mall provisioning API runtime', () => {
  it('requires the direct provisioning role, exact marker, selected writes, and forbidden business domains', async () => {
    const healthy = {
      current_user: 'zhudatuanprovisioningapi',
      session_user: 'zhudatuanprovisioningapi',
      role_safe: true,
      writable: true,
      schema: true,
      contract: true,
      provisioning: true,
      relations: true,
      functions: true,
      selected_writes: true,
      forbidden_privileges: true,
    };
    const pool = (state: typeof healthy) => ({ query: async (sql: string, values: readonly unknown[]) => {
      expect(sql).toContain("to_regprocedure('access.resolve_scope(text,text,text,text)')");
      expect(sql).toContain("has_table_privilege(current_user,'organization.organization','SELECT,INSERT')");
      expect(sql).toContain("has_column_privilege(current_user,'experience.application','head_version_id','UPDATE')");
      expect(sql).toContain("not has_table_privilege(current_user,'identity.session','SELECT,INSERT,UPDATE,DELETE')");
      expect(sql).toContain("not has_schema_privilege(current_user,'payment','USAGE')");
      expect(sql).toContain("not has_schema_privilege(current_user,'finance','USAGE')");
      expect(values).toContain(MALL_PROVISIONING_SCHEMA_VERSION);
      expect(values).toContain(MALL_PROVISIONING_SCHEMA_CHECKSUM);
      return result([state]);
    } }) as unknown as DatabasePool;
    await expect(assertMallProvisioningRuntimeCompatibility(pool(healthy))).resolves.toBeUndefined();
    await expect(assertMallProvisioningRuntimeCompatibility(pool({ ...healthy, current_user: 'shopapp' })))
      .rejects.toThrow('MALL_PROVISIONING_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertMallProvisioningRuntimeCompatibility(pool({ ...healthy, session_user: 'shopmigration' })))
      .rejects.toThrow('MALL_PROVISIONING_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertMallProvisioningRuntimeCompatibility(pool({ ...healthy, role_safe: false })))
      .rejects.toThrow('MALL_PROVISIONING_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertMallProvisioningRuntimeCompatibility(pool({ ...healthy, forbidden_privileges: false })))
      .rejects.toThrow('MALL_PROVISIONING_RUNTIME_COMPATIBILITY_FAILED');
  });
});

function result(rows: readonly object[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
