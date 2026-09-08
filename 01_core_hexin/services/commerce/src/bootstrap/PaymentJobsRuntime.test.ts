import { describe, expect, it, vi } from 'vitest';
import type { PaymentGateway } from '../modules/payment_zhifu/01_public_gongkai/ports_jiekou/PaymentGateway';
import type { DatabasePool } from '../foundation/persistence/Pool';
import {
  assertPaymentJobsRuntimeCompatibility,
  assertPaymentJobsConfiguration,
  assertPaymentJobsNodeManifest,
  createPaymentJobs,
  paymentJobConfig,
  PAYMENT_JOB_KINDS,
} from './PaymentJobsRuntime';

describe('payment-only Jobs runtime', () => {
  it('claims only the bound node scope and uses only node-owned payment callbacks', async () => {
    const path = new URL('../../../../../02_platform_pingtai/config/node-manifests/hbbtzn-l1.json', import.meta.url);
    const manifest = await parseNodeManifest(JSON.parse(await readFile(path, 'utf8')));
    const environment = {
      APP_ENV: 'production',
      DATABASE_JOB_CONNECTION_REF: 'hbbtzn/nodes/l1/database/payment-jobs',
      WECHAT_APPLICATION_CONFIG_REF: 'hbbtzn/nodes/l1/payment/wechat-applications',
      WECHAT_PAYMENT_CONFIG_REF: 'hbbtzn/nodes/l1/payment/wechat',
    };
    expect(paymentJobConfig('hbbtzn-payment-1', 8, manifest.data_scope_ref.ref).scope).toBe(manifest.data_scope_ref.ref);
    expect(() => assertPaymentJobsNodeManifest(manifest, environment)).not.toThrow();
    expect(() => assertPaymentJobsNodeManifest(manifest, {
      ...environment, DATABASE_JOB_CONNECTION_REF: 'zhudatuan/nodes/l0/database/payment-jobs',
    })).toThrow('PAYMENT_JOBS_NODE_SECRET_BINDING_MISMATCH');
    const configuration = {
      notifyUrl: 'https://api.hbbtzn.com/api/v1/webhooks/wechat/payment',
      notifyUrlsByScope: { [manifest.data_scope_ref.ref]: 'https://api.hbbtzn.com/api/v1/webhooks/wechat/payment' },
    } as unknown as WechatPayConfig;
    expect(() => assertPaymentJobsConfiguration(manifest, configuration)).not.toThrow();
    expect(() => assertPaymentJobsConfiguration(manifest, {
      ...configuration, notifyUrl: 'https://api.zhudatuan.com/api/v1/webhooks/wechat/payment',
    })).toThrow('PAYMENT_JOBS_CALLBACK_HOST_MISMATCH');
  });

  it('registers only payment query and refund workers', () => {
    const jobs = createPaymentJobs({} as DatabasePool, {} as PaymentGateway, 'payment-worker-1');
    expect(jobs.map(({ id }) => id)).toEqual(PAYMENT_JOB_KINDS);
  });

  it('requires the canonical shopjob role, schema, claim function, and payment write privileges', async () => {
    const healthy = {
      current_user: 'shopjob', role_safe: true, writable: true, schema: true, contract: true,
      relations: true, functions: true, privileges: true,
    };
    const pool = (state: typeof healthy) => ({ query: vi.fn(async (sql: string) => {
      expect(sql).toContain("to_regprocedure('runtime.claim_job(text,text,integer,integer)')");
      expect(sql).toContain("has_table_privilege(current_user,'runtime.job','SELECT,UPDATE')");
      expect(sql).toContain("has_table_privilege(current_user,'payment.attempt','SELECT,INSERT,UPDATE')");
      expect(sql).toContain("has_table_privilege(current_user,'ordering.orderrecord','SELECT,UPDATE')");
      return result([state]);
    }) }) as unknown as DatabasePool;
    await expect(assertPaymentJobsRuntimeCompatibility(pool(healthy))).resolves.toBeUndefined();
    await expect(assertPaymentJobsRuntimeCompatibility(pool({ ...healthy, current_user: 'zhudatuanidentityjob' })))
      .rejects.toThrow('PAYMENT_JOBS_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertPaymentJobsRuntimeCompatibility(pool({ ...healthy, privileges: false })))
      .rejects.toThrow('PAYMENT_JOBS_RUNTIME_COMPATIBILITY_FAILED');
  });
});

function result(rows: readonly object[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
import { readFile } from 'node:fs/promises';
import { parseNodeManifest } from '@shop/config/server';
import type { WechatPayConfig } from '@shop/wechatpayment';
