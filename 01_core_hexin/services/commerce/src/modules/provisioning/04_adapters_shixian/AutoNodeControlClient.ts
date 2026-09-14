import type { NodeManifest, SignedLevel } from '@shop/config/sfl-node-kernel';
import { token } from '../../../bootstrap/Container';
import type { AccessContext } from '../../../foundation/security/AccessContext';
import { requireAccessNodeContext } from '../../../foundation/security/AccessContext';
import type { CreatedMall } from '../01_public_gongkai/MallOwnerProvisioningPort';

export const AUTONODE_CONTROL_CLIENT = token<AutoNodeControlPort>('provisioning.autonode-control-client');

export type AutoNodeTaskStatus = 'QUEUED' | 'RUNNING' | 'WAITING_EXTERNAL' | 'FAILED_RETRYABLE' | 'SUCCEEDED';

export interface AutoNodeTaskReceipt {
  readonly schema_version: 'sfl.autonode-control-task-receipt.v1';
  readonly task_id: string;
  readonly action: 'ACTIVATE';
  readonly node_id: string;
  readonly status: AutoNodeTaskStatus;
  readonly phase: string;
  readonly progress: number;
  readonly plan_digest: string | null;
  readonly activation_status: string | null;
  readonly waiting_external: readonly string[];
  readonly last_error: Readonly<{ message: string }> | null;
  readonly events: readonly Readonly<{ phase: string; message: string; occurred_at: string }>[];
  readonly created_at: string;
  readonly updated_at: string;
  readonly started_at: string | null;
  readonly finished_at: string | null;
}

export interface AutoNodeControlPort {
  submitMall(mall: CreatedMall, createdAt: string, access: AccessContext, idempotencyKey: string): Promise<AutoNodeTaskReceipt>;
  read(taskId: string): Promise<AutoNodeTaskReceipt>;
  retry(taskId: string): Promise<AutoNodeTaskReceipt>;
}

export class AutoNodeControlClient implements AutoNodeControlPort {
  constructor(
    private readonly sourceSha: string,
    private readonly endpoint = 'http://127.0.0.1:4370',
    private readonly request: typeof fetch = fetch,
  ) {}

  async submitMall(mall: CreatedMall, createdAt: string, access: AccessContext, idempotencyKey: string): Promise<AutoNodeTaskReceipt> {
    const node = requireAccessNodeContext(access).manifest;
    const level = nextLevel(node.signed_level);
    const nodeSlug = mall.publicSlug.toLowerCase();
    return await this.send('/v1/tasks', 'POST', {
      schema_version: 'sfl.autonode-control-task-request.v1',
      task_id: `task:${mall.mallId}`,
      idempotency_key: `node:${idempotencyKey}`,
      action: 'ACTIVATE',
      node_id: `node:${nodeSlug}:${level.toLowerCase()}`,
      requested_by: {
        actor_id: access.actor.id,
        membership_id: access.membership.id,
      },
      activation_request: activationRequest(mall, createdAt, node, level, this.sourceSha, access, idempotencyKey),
    });
  }

  async read(taskId: string): Promise<AutoNodeTaskReceipt> {
    return await this.send(`/v1/tasks/${encodeURIComponent(taskId)}`, 'GET');
  }

  async retry(taskId: string): Promise<AutoNodeTaskReceipt> {
    return await this.send(`/v1/tasks/${encodeURIComponent(taskId)}/retry`, 'POST');
  }

  private async send(path: string, method: 'GET' | 'POST', body?: unknown): Promise<AutoNodeTaskReceipt> {
    const response = await this.request(new URL(path, this.endpoint), {
      method,
      ...(body === undefined ? {} : {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      signal: AbortSignal.timeout(5_000),
    });
    const value = await response.json().catch(() => null);
    if (!response.ok) {
      const code = value && typeof value === 'object' && 'code' in value ? String(value.code) : `HTTP_${response.status}`;
      throw new Error(`AUTONODE_CONTROL_REQUEST_FAILED:${code}`);
    }
    return taskReceipt(value);
  }
}

function activationRequest(
  mall: CreatedMall,
  createdAt: string,
  parent: NodeManifest,
  level: SignedLevel,
  sourceSha: string,
  access: AccessContext,
  idempotencyKey: string,
): Readonly<Record<string, unknown>> {
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error('AUTONODE_SOURCE_SHA_INVALID');
  const slug = mall.publicSlug.toLowerCase();
  const parentPayment = parent.payment_binding_refs[0];
  return Object.freeze({
    schema_version: 'sfl.autonode-activation-request.v1',
    activation_request_id: `activation:${mall.mallId}`,
    idempotency_key: `activation:${idempotencyKey}`,
    provisioning_request: {
      schema_version: 'sfl.autonode-request.v2',
      provisioning_request_id: `provisioning:${mall.mallId}`,
      idempotency_key: `provisioning:${idempotencyKey}`,
      created_at: createdAt,
      line_id: parent.line_id,
      parent_node_id: parent.node_id,
      signed_level: level,
      node_slug: slug,
      display_name: mall.name,
      domains: {
        api: `api.${slug}.hbbtzn.com`,
        console: `console.${slug}.hbbtzn.com`,
        identity: `accounts.${slug}.hbbtzn.com`,
        storefront: `${slug}.hbbtzn.com`,
      },
      business: {
        scope_id: mall.scopeId,
        enterprise_id: mall.enterpriseId,
        code: mall.code,
        public_slug: mall.publicSlug,
        name: mall.name,
      },
      created_by: {
        actor_id: access.actor.id,
        membership_id: access.membership.id,
        authorized_operation: 'provisioning.malls.create',
      },
      artifact: {
        source_sha: sourceSha,
        build_id: parent.release_pointer_ref.build_id,
        build_count: 1,
        immutable_artifact_digest: parent.release_pointer_ref.immutable_artifact_digest,
        source_tree: 'clean',
        client_version: parent.manifest_version,
      },
      resources: {
        tunnel: true,
        tls: true,
        secrets: true,
        wechat_identity: true,
        payment: parentPayment !== undefined,
        callbacks: parent.callback_binding_refs.length > 0,
      },
      binding_sources: {
        domains: {
          mode: 'OWN',
          base_domain: 'hbbtzn.com',
          source_binding_ref: `domain-set:node:${slug}:${level.toLowerCase()}`,
        },
        wechat_identity: {
          mode: 'INHERIT_PARENT',
          source_node_id: parent.node_id,
          source_binding_ref: parent.secret_binding_set_ref.ref,
        },
        payment: parentPayment === undefined ? { mode: 'DISABLED' } : {
          mode: 'INHERIT_PARENT',
          source_node_id: parent.node_id,
          source_binding_ref: parentPayment.ref,
        },
      },
    },
    target: {
      environment: 'production',
      node_root: '/opt/sfl/nodes',
      release_directory: parent.release_pointer_ref.ref,
      runtime_profile_ref: '/opt/sfl/control/autonode/runtime-profile.json',
      systemd_unit_root: '/etc/systemd/system',
    },
  });
}

function nextLevel(level: SignedLevel): SignedLevel {
  const value = Number.parseInt(level.slice(1), 10) + 1;
  if (!Number.isSafeInteger(value) || value < 1 || value > 5) throw new Error('AUTONODE_TARGET_LEVEL_INVALID');
  return `L${value}` as SignedLevel;
}

function taskReceipt(value: unknown): AutoNodeTaskReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AUTONODE_CONTROL_RESPONSE_INVALID');
  const receipt = value as Partial<AutoNodeTaskReceipt>;
  if (receipt.schema_version !== 'sfl.autonode-control-task-receipt.v1'
    || typeof receipt.task_id !== 'string' || typeof receipt.node_id !== 'string'
    || !['QUEUED', 'RUNNING', 'WAITING_EXTERNAL', 'FAILED_RETRYABLE', 'SUCCEEDED'].includes(receipt.status ?? '')
    || typeof receipt.phase !== 'string' || typeof receipt.progress !== 'number'
    || !Array.isArray(receipt.waiting_external) || !Array.isArray(receipt.events)) {
    throw new Error('AUTONODE_CONTROL_RESPONSE_INVALID');
  }
  return Object.freeze(structuredClone(value)) as AutoNodeTaskReceipt;
}
