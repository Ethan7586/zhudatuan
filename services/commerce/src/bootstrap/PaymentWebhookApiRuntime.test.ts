import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import {
  assertPaymentWebhookRuntimeCompatibility,
  PAYMENT_WEBHOOK_SCHEMA_CHECKSUM,
  PAYMENT_WEBHOOK_SCHEMA_VERSION,
} from './PaymentWebhookApiRuntime';

describe('payment webhook API runtime', () => {
  it('requires the direct webhook role, exact marker, selected reads/writes, and no unrelated access', async () => {
    const healthy = {
      current_user: 'zhudatuanpaymentwebhookapi', session_user: 'zhudatuanpaymentwebhookapi', role_safe: true,
      writable: true, schema: true, contract: true, relations: true, functions: true,
      selected_privileges: true, forbidden_privileges: true,
    };
    const pool = (state: typeof healthy) => ({ query: async (sql: string, values: readonly unknown[]) => {
      expect(sql).toContain("to_regprocedure('payment.webhook_scope(text,text,text)')");
      expect(sql).toContain("to_regprocedure('runtime.accept_provider_webhook(text,text,text,jsonb,text,text,text,integer,jsonb)')");
      expect(sql).toContain("has_table_privilege(current_user,'runtime.job','INSERT')");
      expect(sql).toContain("not has_table_privilege(current_user,'runtime.job','SELECT,UPDATE,DELETE')");
      expect(sql).toContain("has_table_privilege(current_user,'audit.record','SELECT,INSERT')");
      expect(sql).toContain("has_table_privilege(current_user,'payment.refundtender','SELECT')");
      expect(sql).toContain("not has_schema_privilege(current_user,'identity','USAGE')");
      expect(sql).toContain("not has_table_privilege(current_user,'runtime.rawenvelope','SELECT,INSERT,UPDATE,DELETE')");
      expect(values).toContain(PAYMENT_WEBHOOK_SCHEMA_VERSION);
      expect(values).toContain(PAYMENT_WEBHOOK_SCHEMA_CHECKSUM);
      return result([state]);
    } }) as unknown as DatabasePool;
    await expect(assertPaymentWebhookRuntimeCompatibility(pool(healthy))).resolves.toBeUndefined();
    await expect(assertPaymentWebhookRuntimeCompatibility(pool({ ...healthy, current_user: 'shopapp' })))
      .rejects.toThrow('PAYMENT_WEBHOOK_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertPaymentWebhookRuntimeCompatibility(pool({ ...healthy, role_safe: false })))
      .rejects.toThrow('PAYMENT_WEBHOOK_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertPaymentWebhookRuntimeCompatibility(pool({ ...healthy, forbidden_privileges: false })))
      .rejects.toThrow('PAYMENT_WEBHOOK_RUNTIME_COMPATIBILITY_FAILED');
  });
});

function result(rows: readonly object[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
