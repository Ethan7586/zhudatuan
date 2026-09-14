import { describe, expect, it, vi } from 'vitest';
import type { AccessContext } from '../../../foundation/security/AccessContext';
import type { CreatedMall } from '../01_public_gongkai/MallOwnerProvisioningPort';
import { AutoNodeControlClient } from '../04_adapters_shixian/AutoNodeControlClient';

describe('AutoNodeControlClient', () => {
  it('submits one deterministic L2 activation task from the committed Mall and parent NodeManifest', async () => {
    const request = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        task_id: 'task:mall:child',
        idempotency_key: 'node:create-key',
        node_id: 'node:h6:l2',
        activation_request: {
          provisioning_request: {
            created_at: '2026-09-14T03:00:00.000Z',
            parent_node_id: 'node:hbbtzn:l1',
            signed_level: 'L2',
            domains: {
              api: 'api.h6.hbbtzn.com',
              console: 'console.h6.hbbtzn.com',
              identity: 'accounts.h6.hbbtzn.com',
              storefront: 'h6.hbbtzn.com',
            },
            business: { scope_id: 'mall:child', public_slug: 'h6' },
          },
        },
      });
      return new Response(JSON.stringify(receipt), { status: 202, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const client = new AutoNodeControlClient('a'.repeat(40), 'http://127.0.0.1:4370', request);

    await expect(client.submitMall(mall, '2026-09-14T03:00:00.000Z', access, 'create-key'))
      .resolves.toEqual(receipt);
    expect(request).toHaveBeenCalledOnce();
  });

  it('proxies task reads and retries without changing the task identity', async () => {
    const calls: string[] = [];
    const request = vi.fn(async (input: URL | RequestInfo) => {
      calls.push(String(input));
      return new Response(JSON.stringify(receipt), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const client = new AutoNodeControlClient('a'.repeat(40), 'http://127.0.0.1:4370', request);

    await client.read('task:mall:child');
    await client.retry('task:mall:child');
    expect(calls).toEqual([
      'http://127.0.0.1:4370/v1/tasks/task%3Amall%3Achild',
      'http://127.0.0.1:4370/v1/tasks/task%3Amall%3Achild/retry',
    ]);
  });
});

const mall: CreatedMall = {
  organizationId: 'mall:child',
  scopeId: 'mall:child',
  mallId: 'mall:child',
  parentId: 'mall:parent',
  enterpriseId: 'mall:parent',
  applicationId: 'application:child',
  poolId: 'pool:child',
  ownerMembershipId: 'membership:child',
  ownerMemberId: 'member:child',
  ownerPrincipalId: 'principal:child',
  code: 'CHILD',
  publicSlug: 'h6',
  name: '华中甄选',
  state: 'ready',
  publicationState: 'draft',
};

const access = {
  actor: {
    id: 'principal:owner',
    nodeContext: {
      manifest: {
        manifest_version: '1.0.1',
        line_id: 'line:zhudatuan:commerce:v1',
        node_id: 'node:hbbtzn:l1',
        signed_level: 'L1',
        secret_binding_set_ref: { ref: 'hbbtzn/nodes/l1/secrets', version: '1' },
        payment_binding_refs: [{ ref: 'hbbtzn/nodes/l1/payment', version: '1' }],
        callback_binding_refs: [{ ref: 'hbbtzn/nodes/l1/callbacks', version: '1' }],
        release_pointer_ref: {
          ref: '/opt/sfl/nodes/hbbtzn-l1/current',
          build_id: 'runtime-bundle',
          immutable_artifact_digest: `sha256:${'b'.repeat(64)}`,
        },
      },
    },
  },
  membership: { id: 'membership:owner' },
} as unknown as AccessContext;

const receipt = {
  schema_version: 'sfl.autonode-control-task-receipt.v1' as const,
  task_id: 'task:mall:child',
  action: 'ACTIVATE' as const,
  node_id: 'node:h6:l2',
  status: 'QUEUED' as const,
  phase: 'QUEUED',
  progress: 0,
  plan_digest: null,
  activation_status: null,
  waiting_external: [],
  last_error: null,
  events: [{ phase: 'QUEUED', message: '平台创建任务已进入执行队列', occurred_at: '2026-09-14T03:00:00.000Z' }],
  created_at: '2026-09-14T03:00:00.000Z',
  updated_at: '2026-09-14T03:00:00.000Z',
  started_at: null,
  finished_at: null,
};
