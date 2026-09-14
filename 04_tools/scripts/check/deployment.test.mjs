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
  workflow: parse(await readFile(resolve(root, '.github/workflows/deploy-prepared-aliyun.yml'), 'utf8')),
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

test('rejects a prepared deployment whose deploy command is only a comment', () => {
  const workflow = structuredClone(current.workflow);
  const step = workflow.jobs.prepared.steps.find((entry) => entry.run?.includes('command=deploy-prepared'));
  step.run = step.run.replace('command=deploy-prepared', '# command=deploy-prepared');
  workflow.documentation = 'command=deploy-prepared';
  assert.throws(() => validateDeploymentContract({ ...current, workflow }), /DEPLOY_WORKFLOW_PREPARED_COMMANDS_MISSING/);
});

test('rejects checkout that is not bound to the exact default-branch control plane', () => {
  const workflow = structuredClone(current.workflow);
  const checkout = workflow.jobs.prepared.steps.find((entry) => entry.uses?.startsWith('actions/checkout@'));
  checkout.with.ref = 'zdt-next';
  assert.throws(() => validateDeploymentContract({ ...current, workflow }), /DEPLOY_WORKFLOW_CONTROL_CHECKOUT_NOT_EXACT/);
});

test('rejects GitHub-hosted runners and build-during-deploy behavior', () => {
  const hosted = structuredClone(current.workflow);
  hosted.jobs.prepared['runs-on'] = 'ubuntu-latest';
  assert.throws(() => validateDeploymentContract({ ...current, workflow: hosted }), /DEPLOY_WORKFLOW_RUNNER_INVALID/);

  const impure = structuredClone(current.workflow);
  impure.jobs.prepared.steps.push({ run: 'npm ci' });
  assert.throws(() => validateDeploymentContract({ ...current, workflow: impure }), /DEPLOY_WORKFLOW_IMPURE/);
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
