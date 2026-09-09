import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import {
  assertIdentityNotificationJobsNodeManifest,
  assertIdentityNotificationRuntimeCompatibility,
  createIdentityNotificationJob,
} from './IdentityNotificationJobsRuntime';

const challenge = 'challenge:00000000-0000-4000-8000-000000000001';

describe('identity notification Jobs runtime', () => {
  it('claims only the dedicated identity notification kind', async () => {
    const controller = new AbortController();
    const claimFunctions: string[] = [];
    let claimed = false;
    const query = vi.fn(async (statement: string, values?: readonly unknown[]) => {
      if (statement.includes('runtime.claim_identity_notification_job')) {
        claimFunctions.push(statement);
        if (claimed) return result([], 0);
        claimed = true;
        return result([{ id: 'job:identity:1', kind: 'identitynotification', scope_id: null, payload: { challenge }, attempts: 1 }], 1);
      }
      if (statement.includes("state='completed'")) return result([], 1);
      throw new Error(`UNEXPECTED_QUERY:${statement}`);
    });
    const pool = { query } as unknown as DatabasePool;
    const dispatch = vi.fn(async () => { controller.abort('test-complete'); });
    const job = createIdentityNotificationJob(pool, { challenge: dispatch }, 'identity-worker-1');
    await job.execute(undefined, { id: 'identitynotification', attempt: 1, signal: controller.signal });
    expect(claimFunctions).toHaveLength(1);
    expect(query.mock.calls.some(([statement]) => String(statement).includes('runtime.claim_job('))).toBe(false);
    expect(dispatch).toHaveBeenCalledWith(challenge);
    expect(query.mock.calls.some(([statement]) => String(statement).includes('runtime:scheduler'))).toBe(false);
  });

  it('claims only jobs routed to its SFL node', async () => {
    const controller = new AbortController();
    const scope = 'node:hbbtzn:l1';
    let claimed = false;
    const query = vi.fn(async (statement: string, _values?: readonly unknown[]) => {
      if (statement.includes('with candidates as')) {
        if (claimed) return result([], 0);
        claimed = true;
        return result([{ id: 'job:identity:l1', kind: 'identitynotification', scope_id: scope,
          payload: { challenge }, attempts: 1 }], 1);
      }
      if (statement.includes("state='completed'")) return result([], 1);
      throw new Error(`UNEXPECTED_QUERY:${statement}`);
    });
    const dispatch = vi.fn(async () => { controller.abort('test-complete'); });
    const job = createIdentityNotificationJob({ query } as unknown as DatabasePool,
      { challenge: dispatch }, 'hbbtzn-l1-identity-notification-1', undefined, scope);

    await job.execute(undefined, { id: 'identitynotification', attempt: 1, signal: controller.signal });

    expect(query.mock.calls.some(([statement]) => String(statement).includes('claim_identity_notification_job'))).toBe(false);
    expect(query.mock.calls.find(([statement]) => String(statement).includes('with candidates as'))?.[1]?.[1]).toBe(scope);
    expect(dispatch).toHaveBeenCalledWith(challenge);
  });

  it('fails startup unless the database is writable, canonical, and owned by shopjob', async () => {
    const healthy = {
      current_user: 'zhudatuanidentityjob', writable: true, schema: true, contract: true, registration: true, runtime_job: true,
      challenge: true, challenge_secret: true, challenge_delivery: true,
    };
    const pool = (state: typeof healthy) => ({ query: async (statement: string) => statement.includes('deployment.runtime_database_boundary')
      ? result([databaseBoundary('zhudatuanidentityjob')], 1) : result([state], 1) }) as unknown as DatabasePool;
    const decoupled = { query: async (statement: string) => statement.includes('deployment.runtime_database_boundary')
      ? result([{ ...databaseBoundary('zhudatuanidentityjob'), business_roles_valid: false }], 1)
      : result([healthy], 1) } as unknown as DatabasePool;
    await expect(assertIdentityNotificationRuntimeCompatibility(pool(healthy))).resolves.toBeUndefined();
    await expect(assertIdentityNotificationRuntimeCompatibility(decoupled)).resolves.toBeUndefined();
    await expect(assertIdentityNotificationRuntimeCompatibility(pool({ ...healthy, current_user: 'shopapp' })))
      .rejects.toThrow('IDENTITY_NOTIFICATION_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertIdentityNotificationRuntimeCompatibility(pool({ ...healthy, contract: false })))
      .rejects.toThrow('IDENTITY_NOTIFICATION_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertIdentityNotificationRuntimeCompatibility(pool({ ...healthy, registration: false })))
      .rejects.toThrow('IDENTITY_NOTIFICATION_RUNTIME_COMPATIBILITY_FAILED');
    const ownerMissing = { query: async (statement: string) => statement.includes('deployment.runtime_database_boundary')
      ? result([{ ...databaseBoundary('zhudatuanidentityjob'), active_platform_owner_count: 0 }], 1)
      : result([healthy], 1) } as unknown as DatabasePool;
    await expect(assertIdentityNotificationRuntimeCompatibility(ownerMissing))
      .rejects.toThrow('LIVE_DATABASE_BOUNDARY_ASSERTION_FAILED');
  });

  it('binds a node worker to the identity-enabled manifest and its own secret namespace', () => {
    const manifest = {
      node_profile: 'operating_mall',
      lifecycle_status: 'active',
      enabled_features: [{ ref: 'feature:identity', version: '1' }],
      secret_binding_set_ref: { ref: 'hbbtzn/nodes/l1/secrets', version: '1' },
    } as never;
    const environment = {
      APP_ENV: 'production',
      DATABASE_JOB_CONNECTION_REF: 'hbbtzn/nodes/l1/database/identity-notification-jobs',
      IDENTITY_NOTIFICATION_CONFIG_REF: 'hbbtzn/nodes/l1/notification/aliyun-sms',
    };

    expect(() => assertIdentityNotificationJobsNodeManifest(manifest, environment)).not.toThrow();
    expect(() => assertIdentityNotificationJobsNodeManifest(manifest, {
      ...environment,
      IDENTITY_NOTIFICATION_CONFIG_REF: 'zhudatuan/registration/notification/aliyun-sms',
    })).toThrow('IDENTITY_NOTIFICATION_JOBS_NODE_SECRET_BINDING_MISMATCH');
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
