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
  workflow: parse(await readFile(resolve(root, '.github/workflows/deploy.yml'), 'utf8')),
  packageJson: JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')),
});

test('accepts the current registered deployment chain', () => {
  const summary = validateDeploymentContract(current);
  assert.equal(summary.project, 'zdt-next');
  assert.equal(summary.targets, Object.keys(current.adapter.targets).length);
  assert.equal(summary.nodes, Object.keys(current.adapter.nodes).length);
});

test('rejects a missing target even when unrelated text retains its name', () => {
  const workflow = structuredClone(current.workflow);
  workflow.on.workflow_dispatch.inputs.release_target.options = workflow.on.workflow_dispatch.inputs.release_target.options.filter((target) => target !== 'console');
  workflow.documentation = 'console';
  assert.throws(() => validateDeploymentContract({ ...current, workflow }), /DEPLOY_WORKFLOW_TARGETS_MISMATCH/);
});

test('rejects a commented deployment command even when unrelated text retains the command', () => {
  const workflow = structuredClone(current.workflow);
  const step = workflow.jobs.deploy.steps.find((entry) => entry.run?.includes('cli.mjs deploy'));
  step.run = step.run.replace('node 04_tools/release-engine/cli.mjs deploy', '# node 04_tools/release-engine/cli.mjs deploy');
  workflow.documentation = 'node 04_tools/release-engine/cli.mjs deploy --environment production --direct';
  assert.throws(() => validateDeploymentContract({ ...current, workflow }), /DEPLOY_WORKFLOW_COMMAND_COUNT:deploy/);
});

test('rejects checkout that is not bound to the requested exact source', () => {
  const workflow = structuredClone(current.workflow);
  const checkout = workflow.jobs.deploy.steps.find((entry) => entry.uses?.startsWith('actions/checkout@'));
  checkout.with.ref = 'zdt-next';
  workflow.documentation = '${{ inputs.head_sha }}';
  assert.throws(() => validateDeploymentContract({ ...current, workflow }), /DEPLOY_WORKFLOW_CHECKOUT_NOT_EXACT/);
});

test('rejects a manifest and remote pointer disagreement', () => {
  const adapter = structuredClone(current.adapter);
  adapter.nodes['zhudatuan-l0'].deployments['identity-api'].pointerRoot = '/opt/incorrect/identity-api';
  assert.throws(() => validateDeploymentContract({ ...current, adapter }), /DEPLOY_POINTER_MISMATCH/);
});

test('rejects a restartable target without rollback baseline or health checks', () => {
  const withoutBaseline = structuredClone(current.policy);
  withoutBaseline.nodes['zhudatuan-l0'].deployments['identity-api'].seedInputs = [];
  assert.throws(() => validateDeploymentContract({ ...current, policy: withoutBaseline }), /DEPLOY_ROLLBACK_BASELINE_MISSING/);

  const withoutHealth = structuredClone(current.policy);
  withoutHealth.nodes['zhudatuan-l0'].deployments['identity-api'].healthChecks = [];
  assert.throws(() => validateDeploymentContract({ ...current, policy: withoutHealth }), /DEPLOY_HEALTH_CHECKS_MISSING/);
});

test('rejects a formal deployment check that omits the behavior suite', () => {
  const packageJson = structuredClone(current.packageJson);
  packageJson.scripts['check:deployment'] = packageJson.scripts['check:deployment'].replace('npm run test:release-engine && ', '');
  packageJson.description = 'npm run test:release-engine';
  assert.throws(() => validateDeploymentContract({ ...current, packageJson }), /DEPLOY_CHECK_ORCHESTRATION_INVALID/);
});
