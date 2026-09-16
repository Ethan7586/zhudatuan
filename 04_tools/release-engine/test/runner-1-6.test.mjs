import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

import { sourceFromIdentifier } from '../runner-1-6.mjs';
import { DeliveryError } from '../src/errors.mjs';
import { runCommand } from '../src/runner.mjs';
import { selectExecutionRunner } from '../src/runner-selection-1-6.mjs';
import { inspectSimpleArtifact, SIMPLE_RELEASE_SCHEMA, simpleReleaseObject } from '../src/simple-artifact-store.mjs';
import { digest, prettyStableJson, sha256 } from '../src/stable.mjs';

const root = resolve(new URL('../../..', import.meta.url).pathname);
const sha = 'a'.repeat(40);

test('Aliyun is selected only when a matching runner is online and idle', () => {
  const selected = selectExecutionRunner({ runners: [{ name: 'aliyun-1', status: 'online', busy: false, labels: ['self-hosted', 'linux', 'x64', 'zdt-aliyun-build', 'zdt-aliyun-build-1'] }] });
  assert.equal(selected.runnerClass, 'aliyun');
  assert.deepEqual(selected.runsOn, ['self-hosted', 'linux', 'x64', 'zdt-aliyun-build', 'zdt-aliyun-build-1']);
});

for (const [name, observation, reason] of [
  ['missing', { runners: [] }, 'aliyun-runner-missing'],
  ['offline', { runners: [{ status: 'offline', busy: false, labels: ['zdt-aliyun-build'] }] }, 'aliyun-runner-offline'],
  ['busy', { runners: [{ status: 'online', busy: true, labels: ['zdt-aliyun-build'] }] }, 'aliyun-runner-busy'],
  ['unreadable', { error: 'forbidden' }, 'aliyun-status-unavailable'],
])
  test(`GitHub Hosted is selected when Aliyun is ${name}`, () => {
    const selected = selectExecutionRunner(observation);
    assert.equal(selected.runnerClass, 'github-hosted');
    assert.equal(selected.reason, reason);
    assert.deepEqual(selected.runsOn, ['ubuntu-24.04']);
  });

test('release id is deterministic and retry resolves the original Source SHA', () => {
  assert.equal(sourceFromIdentifier(sha), sha);
  assert.equal(sourceFromIdentifier(`r16-${sha}`), sha);
  assert.equal(sourceFromIdentifier('invalid'), null);
});

test('simple OSS cache is reused when complete and rebuilt when missing', async () => {
  const adapter = { project: 'zdt-next', targets: { app: {} } };
  const runtime = Buffer.from(JSON.stringify({ project: 'zdt-next', target: 'app', sourceSha: sha }));
  const unsigned = {
    schema: SIMPLE_RELEASE_SCHEMA,
    project: 'zdt-next',
    target: 'app',
    sourceSha: sha,
    artifact: { object: 'artifact.tgz', sha256: `sha256:${'b'.repeat(64)}`, bytes: 12, treeDigest: `sha256:${'c'.repeat(64)}` },
    runtimeManifest: { object: 'manifest.json', sha256: `sha256:${sha256(runtime)}`, manifestDigest: `sha256:${'d'.repeat(64)}` },
    updatedAt: '2026-09-16T00:00:00.000Z',
  };
  const release = { ...unsigned, releaseDigest: digest(unsigned) };
  const hit = await inspectSimpleArtifact(
    adapter,
    { target: 'app', sourceSha: sha },
    {
      getObject: async (object, missingCode) => {
        if (object === simpleReleaseObject('zdt-next', 'app', sha)) return Buffer.from(prettyStableJson(release));
        if (object === 'manifest.json') return runtime;
        throw Object.assign(new Error(missingCode), { code: missingCode });
      },
      headObject: async () => ({ exists: true, bytes: 12, sha256: 'b'.repeat(64) }),
    }
  );
  assert.equal(hit.cacheStatus, 'reused');

  const miss = await inspectSimpleArtifact(
    adapter,
    { target: 'app', sourceSha: sha },
    {
      getObject: async (_object, missingCode) => {
        throw new DeliveryError(missingCode, 'missing');
      },
    }
  );
  assert.equal(miss.cacheStatus, 'rebuild');
  assert.equal(miss.reason, 'SIMPLE_ARTIFACT_NOT_FOUND');
});

test('workflow has one entry, stateless routing, one shared core and pre-core hosted fallback', async () => {
  const workflowSource = await readFile(join(root, '.github/workflows/delivery-1-6.yml'), 'utf8');
  const workflow = parse(workflowSource);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.operation.options, ['release', 'status', 'retry', 'rollback']);
  assert.match(workflowSource, /runs-on: \$\{\{ fromJSON\(needs\.route\.outputs\.runs_on\) \}\}/);
  assert.equal(workflow.jobs.execute.steps.at(-1).uses, './.github/actions/runner-1-6');
  assert.equal(workflow.jobs['hosted-startup-fallback'].steps.at(-1).uses, './.github/actions/runner-1-6');
  assert.match(workflow.jobs['hosted-startup-fallback'].if, /core_started != 'true'/);
  assert.doesNotMatch(workflowSource, /final.?seal|closure|runner.?lease|writer.?lease|slot.?claim|readiness.?doctor|finalizer/i);
});

test('control-side command only dispatches and queries GitHub', async () => {
  const dispatcher = await readFile(join(root, 'scripts/delivery-dispatch.sh'), 'utf8');
  const controller = await readFile(join(root, '02_platform_pingtai/infrastructure/github-actions-runner/zdt-delivery'), 'utf8');
  assert.match(dispatcher, /workflow='delivery-1-6\.yml'/);
  assert.match(dispatcher, /gh workflow run/);
  assert.doesNotMatch(`${dispatcher}\n${controller}`, /npm ci|npm run|\bssh\b|\bscp\b|runner-1-6\.mjs/);
});

test('normal path uses direct artifact deployment and does not depend on old authorities', async () => {
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  const shell = await readFile(join(root, 'scripts/runner-1-6.sh'), 'utf8');
  assert.match(core, /deploy-oss-direct-v2/);
  assert.match(core, /previous/);
  assert.match(core, /rollback/);
  assert.doesNotMatch(core, /from '.\/src\/(?:engine|oss)\.mjs'/);
  assert.doesNotMatch(`${core}\n${shell}`, /final.?seal|closure|writer.?lease|runner.?lease|slot.?claim|readiness.?doctor/i);
  for (const obsolete of ['delivery-1-4-3.yml', 'auto-prepare-artifacts.yml', 'prepare-artifact-aliyun.yml', 'deploy-prepared-aliyun.yml', 'deploy-source-aliyun.yml']) {
    await assert.rejects(access(join(root, '.github/workflows', obsolete)));
  }
});

test('release installs dependencies before dynamic impact planning', async () => {
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  const install = core.indexOf("name: 'install-control-dependencies'");
  const sourceInstall = core.indexOf("name: 'install-source-dependencies'");
  const plan = core.indexOf('const plan = await createReleasePlan');
  assert.ok(install > 0 && sourceInstall > install && sourceInstall < plan);
  assert.match(core, /resolve\(controlRoot\) !== resolve\(adapter\.projectRoot\)/);
});

test('workspace isolation checks the selected source workspace', async () => {
  const isolation = await readFile(join(root, '04_tools/release-engine/adapters/zdt-next/assert-workspace-isolation.mjs'), 'utf8');
  assert.match(isolation, /resolve\(process\.cwd\(\)\)/);
  assert.doesNotMatch(isolation, /fileURLToPath\(import\.meta\.url\)/);
});

test('build command environment expands the exact source SHA', async () => {
  const result = await runCommand(
    {
      name: 'templated-environment',
      argv: [process.execPath, '-e', 'process.stdout.write(process.env.VITE_CLIENT_VERSION)'],
      environment: { VITE_CLIENT_VERSION: '0.0.0-g{{sourceSha}}' },
    },
    { projectRoot: root, environment: {}, changedFiles: [], sourceSha: sha }
  );
  assert.equal(result.output, `0.0.0-g${sha}`);
});
