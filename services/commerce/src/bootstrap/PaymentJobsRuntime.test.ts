import { describe, expect, it, vi } from 'vitest';
import type { PaymentGateway } from '../modules/payment/application/port/PaymentGateway';
import type { DatabasePool } from '../foundation/persistence/Pool';
import {
  assertPaymentJobsRuntimeCompatibility,
  createPaymentJobs,
  PAYMENT_JOB_KINDS,
} from './PaymentJobsRuntime';

describe('payment-only Jobs runtime', () => {
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
