import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

test('reusable Prepare keeps one atomic auto route without a direct user trigger', async () => {
  const source = await readFile(join(root, '.github/workflows/prepare-artifact-aliyun.yml'), 'utf8');
  const workflow = parse(source);
  assert.equal(workflow.on.workflow_dispatch, undefined);
  assert.equal(workflow.on.workflow_call.inputs.build_runner.default, 'auto');
  assert.equal(workflow.jobs.route['runs-on'], 'ubuntu-24.04');
  assert.equal(workflow.jobs.prepare['runs-on'], '${{ fromJSON(needs.route.outputs.runs_on) }}');
  assert.match(source, /select-runner/);
  assert.doesNotMatch(source, /larger|xlarge|[1-9][0-9]-core/i);
  for (const step of workflow.jobs.prepare.steps) assert.doesNotMatch(JSON.stringify(step), /secrets\.ZDT_RELEASE_SSH|operation=deploy|deploy-prepared/);
});

test('the sole normal dispatcher submits exactly one 1.4.3 workflow', async () => {
  const source = await readFile(join(root, 'scripts/delivery-dispatch.sh'), 'utf8');
  assert.match(source, /workflow='delivery-1-4-3\.yml'/);
  assert.equal((source.match(/gh workflow run/g) ?? []).length, 1);
  assert.doesNotMatch(source, /prepare-artifact-aliyun|deploy-prepared-aliyun|deploy-source-aliyun|legacy-.*recovery/);
  assert.match(source, /query status without redispatching/);
  assert.match(source, /databaseId,displayTitle/);
  assert.match(source, /expected_title=/);
});
