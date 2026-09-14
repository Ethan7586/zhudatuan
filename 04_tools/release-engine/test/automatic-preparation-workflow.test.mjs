import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';

import { loadAdapter } from '../src/adapter.mjs';
import { automaticPreparationMatrix } from '../src/automatic-preparation.mjs';
import { classifyChanges } from '../src/planner.mjs';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readWorkflow = async (name) => parse(await readFile(join(projectRoot, '.github/workflows', name), 'utf8'));

test('automatic closure runs only after zdt-next pushes and cannot deploy production', async () => {
  const automatic = await readWorkflow('auto-prepare-artifacts.yml');
  const oneTarget = await readWorkflow('auto-prepare-one-target.yml');
  const source = JSON.stringify({ automatic, oneTarget });

  assert.deepEqual(automatic.on, { push: { branches: ['zdt-next'] } });
  assert.equal(automatic.jobs.close.uses, './.github/workflows/auto-prepare-one-target.yml');
  assert.equal(oneTarget.jobs.prepare.uses, './.github/workflows/prepare-artifact-aliyun.yml');
  assert.equal(oneTarget.jobs.seal.uses, './.github/workflows/deploy-prepared-aliyun.yml');
  assert.equal(oneTarget.jobs.seal.with.operation, 'validate-candidate');
  assert.doesNotMatch(source, /operation[^}]*deploy|zdt-delivery deploy|deploy-sealed-candidate/);
});

test('manual Prepare and Deploy remain callable after becoming reusable', async () => {
  const prepare = await readWorkflow('prepare-artifact-aliyun.yml');
  const deploy = await readWorkflow('deploy-prepared-aliyun.yml');

  assert.ok(prepare.on.workflow_dispatch);
  assert.ok(prepare.on.workflow_call);
  assert.ok(deploy.on.workflow_dispatch);
  assert.ok(deploy.on.workflow_call);
  assert.equal(prepare.on.workflow_call.inputs.build_runner.default, 'aliyun');
  assert.equal(deploy.on.workflow_call.inputs.operation.type, 'string');
});

test('automatic closure files are delivery-only and the real adapter omits hosted aliases', async () => {
  const adapter = await loadAdapter(join(projectRoot, '02_platform_pingtai/infrastructure/release/zdt-next.release.json'));
  const classification = classifyChanges(adapter, [
    { status: 'A', path: '.github/workflows/auto-prepare-artifacts.yml' },
    { status: 'A', path: '.github/workflows/auto-prepare-one-target.yml' },
  ]);
  assert.deepEqual(classification.targets, []);
  assert.deepEqual(classification.unknownFiles, []);

  const entries = automaticPreparationMatrix(adapter, ['console', 'support-api']);
  assert.deepEqual(entries, [
    { target: 'console', prepare_node: 'hbbtzn-l1', seal_nodes_json: '["hbbtzn-l1","zhudatuan-l0"]' },
    { target: 'support-api', prepare_node: 'zhudatuan-l0', seal_nodes_json: '["zhudatuan-l0"]' },
  ]);
});
