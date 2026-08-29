import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { PurchaseSessionResolver } from '../modules/purchase/PurchaseSessionResolver';
import {
  PURCHASE_SCHEMA_CHECKSUM,
  PURCHASE_SCHEMA_VERSION,
  assertPurchaseRuntimeCompatibility,
} from './PurchaseApiRuntime';

describe('purchase API runtime', () => {
  it('requires the direct purchase role, exact marker, selected writes, and forbidden finance/provider writes', async () => {
    const healthy = {
      current_user: 'zhudatuanpurchaseapi', session_user: 'zhudatuanpurchaseapi', role_safe: true, writable: true,
      schema: true, contract: true, purchase: true, relations: true, functions: true, selected_writes: true, forbidden_privileges: true,
    };
    const pool = (state: typeof healthy) => ({ query: async (sql: string, values: readonly unknown[]) => {
      expect(sql).toContain("to_regprocedure('access.resolve_scope(text,text,text,text)')");
      expect(sql).toContain("to_regprocedure('benefit.purchase_consume(text,text,text,text,text,bigint)')");
      expect(sql).toContain("not has_schema_privilege(current_user,'finance','USAGE')");
      expect(sql).toContain("namespace.nspname='finance' and procedure.proname='post'");
      expect(sql).toContain("has_function_privilege(current_user,procedure.oid,'EXECUTE')");
      expect(sql).not.toContain("has_function_privilege(current_user,\n        'finance.post");
      expect(sql).toContain("not has_table_privilege(current_user,'payment.refund','INSERT,UPDATE,DELETE')");
      expect(sql).toContain("not has_table_privilege(current_user,'payment.recoverycase','INSERT,UPDATE,DELETE')");
      expect(sql).toContain("not has_table_privilege(current_user,'ordering.orderrecord','UPDATE')");
      expect(sql).toContain("has_column_privilege(current_user,'ordering.orderrecord','payment_state','UPDATE')");
      expect(sql).toContain("not has_column_privilege(current_user,'ordering.orderrecord','member_id','UPDATE')");
      expect(sql).toContain("not has_table_privilege(current_user,'payment.intent','UPDATE')");
      expect(sql).toContain("not has_column_privilege(current_user,'payment.intent','amount_minor','UPDATE')");
      expect(sql).toContain("not has_table_privilege(current_user,'pricing.quote','UPDATE')");
      expect(sql).toContain("not has_column_privilege(current_user,'inventory.stockitem','scope_id','UPDATE')");
      expect(sql).not.toContain("has_column_privilege(current_user,'inventory.stockitem','mall_id'");
      expect(values).toContain(PURCHASE_SCHEMA_VERSION);
      expect(values).toContain(PURCHASE_SCHEMA_CHECKSUM);
      return result([state]);
    } }) as unknown as DatabasePool;
    await expect(assertPurchaseRuntimeCompatibility(pool(healthy))).resolves.toBeUndefined();
    await expect(assertPurchaseRuntimeCompatibility(pool({ ...healthy, current_user: 'shopapp' })))
      .rejects.toThrow('PURCHASE_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertPurchaseRuntimeCompatibility(pool({ ...healthy, session_user: 'shopmigration' })))
      .rejects.toThrow('PURCHASE_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertPurchaseRuntimeCompatibility(pool({ ...healthy, role_safe: false })))
      .rejects.toThrow('PURCHASE_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertPurchaseRuntimeCompatibility(pool({ ...healthy, forbidden_privileges: false })))
      .rejects.toThrow('PURCHASE_RUNTIME_COMPATIBILITY_FAILED');
  });
});

describe('purchase API session boundary', () => {
  it('rejects a Console credential immediately after session resolution', async () => {
    const actor = {
      id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1,
      accessVersion: 1, target: 'console' as const, assurance: { level: 2 },
    };
    const resolver = new PurchaseSessionResolver({ resolve: async () => actor });
    await expect(resolver.resolve({ authorization: 'Bearer token' })).rejects.toThrow('PURCHASE_AUDIENCE_TARGET_MISMATCH');
  });
});

function result(rows: readonly object[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
