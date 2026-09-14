import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const workflowSource = await readFile(join(root, '.github/workflows/deploy-source-aliyun.yml'), 'utf8');
const workflow = parse(workflowSource);
const autoSource = await readFile(join(root, '.github/workflows/auto-prepare-artifacts.yml'), 'utf8');
const auto = parse(autoSource);

test('sealed-source deployment is explicit, consumes one closure manifest and never builds', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.ok(workflow.on.workflow_dispatch.inputs.head_sha.required);
  assert.match(workflow.jobs.resolve.steps[0].run, /automatic-artifact-closure-\$SOURCE_SHA/);
  assert.doesNotMatch(workflowSource, /npm ci|prepare-artifact-aliyun|\bbuild\b|operation: validate-candidate/);
  assert.equal((workflowSource.match(/operation: deploy/g) ?? []).length, 3);
});

test('deployment waves stop forward progress after a failed earlier wave', () => {
  assert.deepEqual(workflow.jobs.runtimes.needs, ['resolve', 'migrations']);
  assert.deepEqual(workflow.jobs.frontends.needs, ['resolve', 'migrations', 'runtimes']);
  assert.match(workflow.jobs.runtimes.if, /needs\.migrations\.result == 'success'/);
  assert.match(workflow.jobs.frontends.if, /needs\.runtimes\.result == 'success'/);
  assert.equal(workflow.jobs.migrations.with.operation, 'deploy');
  assert.equal(workflow.jobs.runtimes.with.operation, 'deploy');
  assert.equal(workflow.jobs.frontends.with.operation, 'deploy');
});

test('automatic closure preserves its exact machine-readable deployment scope', () => {
  const upload = auto.jobs.plan.steps.find((step) => step.uses === 'actions/upload-artifact@v6');
  assert.equal(upload.with.name, 'automatic-artifact-closure-${{ github.sha }}');
  assert.equal(upload.with.path, '.automatic-artifact-closure/closure.json');
  assert.equal(upload.with['if-no-files-found'], 'error');
});
