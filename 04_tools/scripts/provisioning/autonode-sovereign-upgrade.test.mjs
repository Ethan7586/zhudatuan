import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  AUTONODE_SOVEREIGN_UPGRADE_STEPS,
  applySovereignUpgradePlan,
  hostedNodeAutoNodeProjection,
  sovereignUpgradeAutoNodePlan,
} from './autonode-sovereign-upgrade.mjs';

test('only an explicit sovereign upgrade produces an AutoNode resource plan', async () => {
  const cli = await readFile(new URL('./autonode.mjs', import.meta.url), 'utf8');
  assert.match(cli, /plan-sovereign-upgrade/);
  assert.doesNotMatch(cli, /FileNodeProvisioningEngine|command !== 'provision'/);
  for (let level = 2; level <= 11; level += 1) assert.equal(hostedNodeAutoNodeProjection({ signed_level: `L${level}` }), null);
  assert.throws(() => sovereignUpgradeAutoNodePlan({ operation: 'hosted_registration' }),
    /AUTONODE_SOVEREIGN_UPGRADE_INTENT_REQUIRED/);
  assert.throws(() => sovereignUpgradeAutoNodePlan({ operation: 'hosted_mall_opening' }),
    /AUTONODE_SOVEREIGN_UPGRADE_INTENT_REQUIRED/);

  const plan = sovereignUpgradeAutoNodePlan(fixture('l8'));
  assert.equal(plan.node_id, 'node:l8');
  assert.equal(plan.hosts.console, 'console.l8.example.com');
  assert.equal(plan.bindings.payment, 'payment:l8:v1');
  assert.match(plan.plan_digest, /^sha256:[0-9a-f]{64}$/);

  const provider = fakeProvider();
  const results = await Promise.all(Array.from({ length: 5 }, () => applySovereignUpgradePlan(plan, provider)));
  assert(results.every((result) => result.plan_digest === plan.plan_digest));
  assert.equal(provider.invocations.size, AUTONODE_SOVEREIGN_UPGRADE_STEPS.length);
});

test('node resource plans remain isolated and retry converges after three injected failures', async () => {
  const first = sovereignUpgradeAutoNodePlan(fixture('l2'));
  const second = sovereignUpgradeAutoNodePlan(fixture('l5'));
  assert.notDeepEqual(first.hosts, second.hosts);
  assert.equal(new Set([...Object.values(first.hosts), ...Object.values(second.hosts)]).size, 10);
  assert.equal(new Set([...Object.values(first.bindings), ...Object.values(second.bindings)]).size, 18);
  assert.notEqual(first.manifest_digest, second.manifest_digest);

  for (const failedStep of AUTONODE_SOVEREIGN_UPGRADE_STEPS.slice(0, 3)) {
    const provider = fakeProvider(failedStep);
    await assert.rejects(() => applySovereignUpgradePlan(first, provider), new RegExp(`INJECTED:${failedStep}`));
    provider.failedStep = null;
    const recovered = await applySovereignUpgradePlan(first, provider);
    assert.equal(recovered.receipts.length, AUTONODE_SOVEREIGN_UPGRADE_STEPS.length);
    assert.equal(provider.invocations.size, AUTONODE_SOVEREIGN_UPGRADE_STEPS.length);
  }
});

function fixture(key) {
  const hosts = (surface) => `${surface}.${key}.example.com`;
  return {
    operation: 'sovereign_upgrade',
    request: {
      idempotency_key: `upgrade:${key}`, brand_ref: `brand:${key}:v1`, public_api_host: hosts('api'),
      storefront_host: hosts('shop'), accounts_host: hosts('accounts'), console_host: hosts('console'),
      payment_callback_host: hosts('pay'), edge_binding_ref: `edge:${key}:v1`, tunnel_ref: `tunnel:${key}:v1`,
      gateway_ref: `gateway:${key}:v1`, runtime_identity_ref: `runtime:${key}:v1`, data_scope_ref: `scope:${key}:v1`,
      secret_binding_set_ref: `secrets:${key}:v1`, payment_binding_ref: `payment:${key}:v1`,
      callback_binding_ref: `callback:${key}:v1`, runtime_config_ref: `runtime-config:${key}:v1`,
    },
    upgrade: {
      business_number: `SFLSOV-${key}`, upgrade_id: `upgrade:${key}`, idempotency_key: `upgrade:${key}`,
      request_hash: hashCharacter(key).repeat(64), node_id: `node:${key}`, membership_id: `membership:${key}`,
      principal_id: `principal:${key}`, mall_id: `mall:${key}`, operating_entity_id: `enterprise:${key}`,
      realm_id: `realm:${key}`, line_id: 'line:1', signed_level: key === 'l2' ? 'L2' : key === 'l5' ? 'L5' : 'L8',
      parent_node_id: 'node:parent', original_parent_node_id: 'node:parent',
      previous_host_sovereign_node_id: 'node:l0', host_sovereign_node_id: `node:${key}`,
      source_tier: 'hosted', target_tier: 'sovereign', node_profile: 'operating_mall', status: 'bindings_complete',
      previous_relation_version: 1, active_relation_version: 2, sovereignty_version: 1,
      domain_binding_set_version: 1, resource_binding_version: 1, manifest_version: 1,
      manifest_digest: `sha256:${hashCharacter(key).repeat(64)}`, manifest_summary: { surface_count: 5 },
      recoverable: true, upgraded_at: '2026-09-12T00:00:00.000Z', replayed: false,
    },
  };
}

function fakeProvider(initialFailure = null) {
  return {
    failedStep: initialFailure,
    invocations: new Map(),
    async apply(step, plan, invocationId) {
      if (this.failedStep === step) throw new Error(`INJECTED:${step}`);
      if (!this.invocations.has(invocationId)) {
        this.invocations.set(invocationId, Object.freeze({ node_id: plan.node_id, step, status: 'ready' }));
      }
      return this.invocations.get(invocationId);
    },
  };
}

function hashCharacter(key) {
  return key === 'l2' ? 'a' : key === 'l5' ? 'b' : 'c';
}
