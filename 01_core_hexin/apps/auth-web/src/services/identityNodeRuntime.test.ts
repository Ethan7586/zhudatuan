import { describe, expect, it } from 'vitest';
import { PRODUCTION_IDENTITY_NODE_REGISTRY } from '@shop/sdk/identity-node';
import {
  configuredIdentityNode,
  configuredIdentityNodeRegistry,
  installIdentityNodeRuntime,
  loadIdentityNodeRuntime,
} from './identityNodeEnvironment';

const sourceSha = 'a'.repeat(40);
const artifactDigest = `sha256:${'b'.repeat(64)}`;
const generatedNode = {
  ...PRODUCTION_IDENTITY_NODE_REGISTRY.nodes[1]!,
  nodeId: 'node:generated:l1',
  displayName: '生成节点',
  mallName: '生成商城',
  brandName: '生成商城',
  accountsOrigin: 'https://accounts.generated.invalid',
  accountsHost: 'accounts.generated.invalid',
  apiOrigin: 'https://api.generated.invalid',
  consumerApiOrigin: 'https://api.generated.invalid',
  storefrontOrigin: 'https://store.generated.invalid',
  storefrontHosts: ['store.generated.invalid'],
  adminOrigin: 'https://console.generated.invalid',
  mallId: 'mall:generated',
};
const runtime = {
  schema_version: 'sfl.identity-node-runtime.v1',
  source_sha: sourceSha,
  build_id: 'shared-build',
  build_count: 1,
  immutable_artifact_digest: artifactDigest,
  identity_node_registry: { version: 2, nodes: [generatedNode] },
} as const;

describe('identity node runtime', () => {
  it('installs one generated node without rebuilding the auth artifact', () => {
    installIdentityNodeRuntime(runtime, 'accounts.generated.invalid');
    expect(configuredIdentityNode('accounts.generated.invalid')).toMatchObject({
      nodeId: 'node:generated:l1',
      mallId: 'mall:generated',
    });
    expect(configuredIdentityNodeRegistry()).toHaveProperty('nodes.0.accountsHost', 'accounts.generated.invalid');
  });

  it('loads the same-origin runtime file and fails closed on a host mismatch', async () => {
    const fetcher = async () => new Response(JSON.stringify(runtime), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    await expect(loadIdentityNodeRuntime(fetcher, 'accounts.generated.invalid')).resolves.toBe(true);
    await expect(loadIdentityNodeRuntime(fetcher, 'accounts.other.invalid'))
      .rejects.toThrow('IDENTITY_NODE_RUNTIME_HOST_MISMATCH');
  });

  it('keeps existing nodes compatible when the runtime file is not present', async () => {
    await expect(loadIdentityNodeRuntime(async () => new Response('', { status: 404 })))
      .resolves.toBe(false);
    await expect(loadIdentityNodeRuntime(async () => new Response('<!doctype html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }))).resolves.toBe(false);
  });
});
