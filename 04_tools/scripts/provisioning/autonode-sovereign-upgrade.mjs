import { createHash } from 'node:crypto';

import {
  canonicalJson,
  parseSovereignUpgradeRequest,
  parseSovereignUpgradeResult,
} from '../../../01_core_hexin/packages/config/src/SflNodeKernel.ts';

export const AUTONODE_SOVEREIGN_UPGRADE_PLAN_SCHEMA_VERSION = 'sfl.autonode-sovereign-upgrade-plan.v1';
export const AUTONODE_SOVEREIGN_UPGRADE_STEPS = Object.freeze([
  'DOMAIN_BINDINGS_READY',
  'TUNNEL_GATEWAY_READY',
  'RUNTIME_BINDINGS_READY',
  'MANIFEST_READY',
]);

/**
 * Explicit adapter into reusable AutoNode resource providers. It has no registration,
 * level traversal, process creation or deployment entrypoint of its own.
 */
export function sovereignUpgradeAutoNodePlan(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.operation !== 'sovereign_upgrade') {
    throw new Error('AUTONODE_SOVEREIGN_UPGRADE_INTENT_REQUIRED');
  }
  const request = parseSovereignUpgradeRequest(value.request);
  const upgrade = parseSovereignUpgradeResult(value.upgrade);
  if (upgrade.status !== 'bindings_complete' && upgrade.status !== 'upgraded') {
    throw new Error('AUTONODE_SOVEREIGN_UPGRADE_BINDINGS_INCOMPLETE');
  }
  const plan = {
    schema_version: AUTONODE_SOVEREIGN_UPGRADE_PLAN_SCHEMA_VERSION,
    operation: 'sovereign_upgrade',
    upgrade_id: upgrade.upgrade_id,
    node_id: upgrade.node_id,
    mall_id: upgrade.mall_id,
    realm_id: upgrade.realm_id,
    domain_binding_set_version: upgrade.domain_binding_set_version,
    resource_binding_version: upgrade.resource_binding_version,
    manifest_version: upgrade.manifest_version,
    manifest_digest: upgrade.manifest_digest,
    hosts: Object.freeze({
      public_api: request.public_api_host,
      storefront: request.storefront_host,
      accounts: request.accounts_host,
      console: request.console_host,
      payment_callback: request.payment_callback_host,
    }),
    bindings: Object.freeze({
      edge: request.edge_binding_ref,
      tunnel: request.tunnel_ref,
      gateway: request.gateway_ref,
      runtime_identity: request.runtime_identity_ref,
      data_scope: request.data_scope_ref,
      secrets: request.secret_binding_set_ref,
      payment: request.payment_binding_ref,
      callback: request.callback_binding_ref,
      runtime_config: request.runtime_config_ref,
    }),
  };
  return Object.freeze({ ...plan, plan_digest: digest(plan) });
}

export async function applySovereignUpgradePlan(plan, provider, options = {}) {
  if (plan?.schema_version !== AUTONODE_SOVEREIGN_UPGRADE_PLAN_SCHEMA_VERSION) {
    throw new Error('AUTONODE_SOVEREIGN_UPGRADE_PLAN_INVALID');
  }
  if (!provider || typeof provider.apply !== 'function') throw new Error('AUTONODE_SOVEREIGN_UPGRADE_PROVIDER_INVALID');
  const receipts = [];
  for (const step of AUTONODE_SOVEREIGN_UPGRADE_STEPS) {
    const invocationId = `${plan.upgrade_id}:${step}`;
    const receipt = await provider.apply(step, plan, invocationId);
    receipts.push(Object.freeze({ step, invocation_id: invocationId, receipt }));
    await options.afterStep?.(step, receipt);
  }
  return Object.freeze({ plan_digest: plan.plan_digest, receipts: Object.freeze(receipts) });
}

/** Hosted node creation and ordinary mall opening deliberately have no AutoNode projection. */
export function hostedNodeAutoNodeProjection() {
  return null;
}

function digest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}
