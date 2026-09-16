import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import { parse } from 'yaml';

import { validateDeploymentContract } from './deployment.mjs';

const root = resolve(import.meta.dirname, '../../..');
const current = Object.freeze({
  adapter: JSON.parse(await readFile(resolve(root, '02_platform_pingtai/infrastructure/release/zdt-next.release.json'), 'utf8')),
  policy: JSON.parse(await readFile(resolve(root, '02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json'), 'utf8')),
  workflow: parse(await readFile(resolve(root, '.github/workflows/delivery-1-6.yml'), 'utf8')),
});

test('accepts the current registered deployment chain', () => {
  const summary = validateDeploymentContract(current);
  assert.equal(summary.project, 'zdt-next');
  assert.equal(summary.targets, Object.keys(current.adapter.targets).length);
  assert.equal(summary.nodes, Object.keys(current.adapter.nodes).length);
});

test('rejects a missing rollback target input', () => {
  const workflow = structuredClone(current.workflow);
  delete workflow.on.workflow_dispatch.inputs.release_target;
  assert.throws(() => validateDeploymentContract({ ...current, workflow }), /DEPLOY_WORKFLOW_TARGET_INPUT_INVALID/);
});

test('rejects a workflow that does not share the same execution core', () => {
  const workflow = structuredClone(current.workflow);
  workflow.jobs.execute.steps.at(-1).uses = './different-core';
  assert.throws(() => validateDeploymentContract({ ...current, workflow }), /DEPLOY_WORKFLOW_SHARED_CORE_MISSING/);
});

test('rejects automatic runner switching after the core started', () => {
  const workflow = structuredClone(current.workflow);
  workflow.jobs['hosted-startup-fallback'].if = '${{ always() && needs.execute.result == "failure" }}';
  assert.throws(() => validateDeploymentContract({ ...current, workflow }), /DEPLOY_WORKFLOW_FALLBACK_SCOPE_INVALID/);
});

test('rejects a manifest and remote pointer disagreement', () => {
  const adapter = structuredClone(current.adapter);
  adapter.nodes['zhudatuan-l0'].deployments['identity-api'].pointerRoot = '/opt/incorrect/identity-api';
  assert.throws(() => validateDeploymentContract({ ...current, adapter }), /DEPLOY_POINTER_MISMATCH/);
});

test('rejects a restartable target without rollback baseline or health checks', () => {
  const withoutBaseline = structuredClone(current.policy);
  withoutBaseline.nodes['zhudatuan-l0'].deployments['identity-api'].seedInputs = [];
  delete withoutBaseline.nodes['zhudatuan-l0'].deployments['identity-api'].baselineStrategy;
  assert.throws(() => validateDeploymentContract({ ...current, policy: withoutBaseline }), /DEPLOY_ROLLBACK_BASELINE_MISSING/);

  const withoutHealth = structuredClone(current.policy);
  withoutHealth.nodes['zhudatuan-l0'].deployments['identity-api'].healthChecks = [];
  assert.throws(() => validateDeploymentContract({ ...current, policy: withoutHealth }), /DEPLOY_HEALTH_CHECKS_MISSING/);
});
