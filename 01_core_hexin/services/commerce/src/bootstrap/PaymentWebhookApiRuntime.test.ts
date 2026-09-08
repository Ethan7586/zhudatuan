import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import {
  assertPaymentWebhookConfiguration,
  assertPaymentWebhookNodeManifest,
  assertPaymentWebhookRuntimeCompatibility,
  PAYMENT_WEBHOOK_SCHEMA_CHECKSUM,
  PAYMENT_WEBHOOK_SCHEMA_VERSION,
} from './PaymentWebhookApiRuntime';

describe('payment webhook API runtime', () => {
  it('binds the provider callback process to the L1 manifest and API host', async () => {
    const path = new URL('../../../../../02_platform_pingtai/config/node-manifests/hbbtzn-l1.json', import.meta.url);
    const manifest = await parseNodeManifest(JSON.parse(await readFile(path, 'utf8')));
    const environment = {
      APP_ENV: 'production',
      DATABASE_API_CONNECTION_REF: 'hbbtzn/nodes/l1/database/payment-webhook-api',
      WECHAT_APPLICATION_CONFIG_REF: 'hbbtzn/nodes/l1/payment/wechat-applications',
      WECHAT_PAYMENT_CONFIG_REF: 'hbbtzn/nodes/l1/payment/wechat',
    };
    expect(() => assertPaymentWebhookNodeManifest(manifest, environment)).not.toThrow();
    expect(() => assertPaymentWebhookNodeManifest(manifest, {
      ...environment, WECHAT_PAYMENT_CONFIG_REF: 'zhudatuan/nodes/l0/payment/wechat',
    })).toThrow('PAYMENT_WEBHOOK_NODE_PAYMENT_BINDING_MISMATCH');
    const configuration = {
      notifyUrl: 'https://api.hbbtzn.com/api/v1/webhooks/wechat/payment', notifyUrlsByScope: {},
    } as unknown as WechatPayConfig;
    expect(() => assertPaymentWebhookConfiguration(manifest, configuration)).not.toThrow();
    expect(() => assertPaymentWebhookConfiguration(manifest, {
      ...configuration, notifyUrl: 'https://api.zhudatuan.com/api/v1/webhooks/wechat/payment',
    })).toThrow('PAYMENT_WEBHOOK_CALLBACK_HOST_MISMATCH');
  });

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
import { readFile } from 'node:fs/promises';
import { parseNodeManifest } from '@shop/config/server';
import type { WechatPayConfig } from '@shop/wechatpayment';
