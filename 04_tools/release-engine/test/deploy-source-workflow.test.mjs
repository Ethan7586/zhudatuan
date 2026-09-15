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
const resolveStep = workflow.jobs.resolve.steps.find(
  (step) => step.name === 'Resolve exact successful automatic closure',
);

test('sealed-source deployment is explicit, consumes one closure manifest and never builds', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_call']);
  assert.ok(workflow.on.workflow_call.inputs.head_sha.required);
  assert.ok(resolveStep);
  assert.match(resolveStep.run, /automatic-artifact-closure-\$SOURCE_SHA/);
  assert.match(resolveStep.run, /gh run list --repo "\$GITHUB_REPOSITORY"/);
  assert.doesNotMatch(resolveStep.run, /--event push/);
  assert.match(resolveStep.run, /actions\/runs\/\$\{candidate_id\}\/artifacts/);
  assert.match(resolveStep.run, /automatic-artifact-closure-\$\{SOURCE_SHA\}/);
  assert.match(resolveStep.run, /gh run download "\$candidate_id" --repo "\$GITHUB_REPOSITORY"/);
  assert.match(resolveStep.run, /verifyProductionClosureManifest/);
  assert.doesNotMatch(workflowSource, /prepare-artifact-aliyun|\bbuild\b|operation: validate-candidate/);
  assert.equal((workflowSource.match(/operation: deploy/g) ?? []).length, 3);
  for (const jobName of ['migrations', 'runtimes', 'frontends']) {
    assert.equal(workflow.jobs[jobName].with.seal_control_sha, '${{ matrix.seal_control_sha }}');
    assert.equal(workflow.jobs[jobName].with.seal_artifact_digest, '${{ matrix.artifact_digest }}');
    assert.equal(workflow.jobs[jobName].with.seal_key, '${{ matrix.seal_key }}');
    assert.equal(
      workflow.jobs[jobName].with.seal_receipt_object,
      '${{ matrix.final_seal_receipt_object }}',
    );
  }
});

test('a delivery-only source closes successfully without restarting production targets', () => {
  assert.doesNotMatch(resolveStep.run, /Automatic closure contains no deployable target/);
  assert.match(resolveStep.run, /deployment completed as a no-op/);
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
  assert.equal(auto.on.workflow_dispatch.inputs.base_sha.required, false);
  const planUpload = auto.jobs.plan.steps.find((step) => step.uses === 'actions/upload-artifact@v6');
  assert.equal(planUpload.with.name, 'automatic-artifact-plan-${{ steps.matrix.outputs.source_sha }}');
  assert.equal(planUpload.with.path, '.automatic-artifact-closure/closure.json');
  assert.equal(planUpload.with['if-no-files-found'], 'error');

  assert.deepEqual(auto.jobs.finalize.needs, ['plan', 'close']);
  assert.deepEqual(auto.jobs.finalize['runs-on'], ['self-hosted', 'linux', 'x64', 'zdt-aliyun-release']);
  assert.match(auto.jobs.finalize.if, /needs\.close\.result == 'success'/);
  assert.match(auto.jobs.finalize.if, /needs\.close\.result == 'skipped'/);
  const finalizeStep = auto.jobs.finalize.steps.find(
    (step) => step.name === 'Require every exact final Seal and finalize one authority',
  );
  assert.match(finalizeStep.run, /finalizeProductionClosureManifest/);
  assert.match(finalizeStep.run, /verifyProductionClosureManifest/);

  const finalUpload = auto.jobs.finalize.steps.find(
    (step) => step.uses === 'actions/upload-artifact@v6',
  );
  assert.equal(finalUpload.with.name, 'automatic-artifact-closure-${{ needs.plan.outputs.source_sha }}');
  assert.equal(finalUpload.with.path, '.automatic-artifact-closure/closure.json');
  assert.equal(finalUpload.with['if-no-files-found'], 'error');
});
