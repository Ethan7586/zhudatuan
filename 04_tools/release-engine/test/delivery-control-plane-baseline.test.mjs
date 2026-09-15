import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const engineRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const projectRoot = join(engineRoot, '../..');
const fixture = JSON.parse(await readFile(join(engineRoot, 'test/fixtures/delivery-control-plane-1.4.2.json'), 'utf8'));
const source = (path) => readFile(join(projectRoot, path), 'utf8');

test('1.4.2 baseline has one complete, internally consistent score and protocol chain', () => {
  assert.equal(fixture.schema, 'zdt.delivery-control-plane-baseline/v1');
  assert.match(fixture.controlPlane.sha, /^[a-f0-9]{40}$/);
  assert.equal(fixture.controlPlane.sourceShaIsIndependent, true);
  assert.deepEqual(fixture.pipeline.map(({ id }) => id), [
    'request', 'target-identification', 'runner-routing', 'build', 'oss-publication', 'candidate-validation', 'seal', 'deploy',
  ]);
  for (const step of fixture.pipeline) {
    for (const field of ['input', 'output', 'storage', 'failure', 'recovery', 'authority']) {
      assert.ok(Array.isArray(step[field]) && step[field].length > 0, `${step.id}.${field} must be explicit`);
    }
  }
  assert.equal(fixture.score.dimensions.reduce((sum, item) => sum + item.score, 0), fixture.score.total);
  assert.equal(fixture.score.dimensions.reduce((sum, item) => sum + item.maximum, 0), fixture.score.maximum);
});

test('entry classification covers every release workflow exactly once', async () => {
  const classified = [
    ...fixture.entries.official.workflows.map(({ path }) => path),
    ...fixture.entries.disasterRecovery.map(({ path }) => path),
    ...fixture.entries.pureHistory.map(({ path }) => path),
    ...fixture.entries.diagnostics.map(({ path }) => path),
  ];
  assert.equal(new Set(classified).size, classified.length);
  assert.deepEqual([...classified].sort(), [
    '.github/workflows/auto-prepare-artifacts.yml',
    '.github/workflows/auto-prepare-one-target.yml',
    '.github/workflows/deploy-oss.yml',
    '.github/workflows/deploy-prepared-aliyun.yml',
    '.github/workflows/deploy-prepared.yml',
    '.github/workflows/deploy-source-aliyun.yml',
    '.github/workflows/legacy-direct-recovery-aliyun.yml',
    '.github/workflows/legacy-oss-recovery-aliyun.yml',
    '.github/workflows/prepare-artifact-aliyun.yml',
    '.github/workflows/prepare-artifact.yml',
    '.github/workflows/quality-aliyun.yml',
    '.github/workflows/quality.yml',
    '.github/workflows/register-current-baseline-aliyun.yml',
    '.github/workflows/register-current-baseline.yml',
    '.github/workflows/runner-slots-smoke.yml',
  ]);
  for (const path of classified) await assert.doesNotReject(source(path));
});

test('official orchestration preserves Build, seal, and Deploy separation', async () => {
  const [automatic, oneTarget, prepare, deploy, deploySource] = await Promise.all([
    source('.github/workflows/auto-prepare-artifacts.yml'),
    source('.github/workflows/auto-prepare-one-target.yml'),
    source('.github/workflows/prepare-artifact-aliyun.yml'),
    source('.github/workflows/deploy-prepared-aliyun.yml'),
    source('.github/workflows/deploy-source-aliyun.yml'),
  ]);
  assert.match(automatic, /push:\n\s+branches:\n\s+- zdt-next/);
  assert.match(oneTarget, /uses: \.\/\.github\/workflows\/prepare-artifact-aliyun\.yml/);
  assert.match(oneTarget, /operation: validate-candidate/);
  assert.match(prepare, /select-runner/);
  assert.match(prepare, /runs-on: \$\{\{ fromJSON\(needs\.route\.outputs\.runs_on\) \}\}/);
  assert.match(prepare, /--actor-role build/);
  assert.match(prepare, /--build-runner "\$RUNNER_NAME"/);
  assert.doesNotMatch(prepare, /\$HOME\/\.ssh|operation:\s*deploy/);
  assert.match(deploy, /runs-on: \[self-hosted, linux, x64, zdt-aliyun-release\]/);
  assert.equal((deploySource.match(/operation: deploy/g) ?? []).length, 3);
  assert.doesNotMatch(automatic, /operation:\s*deploy/);
  assert.doesNotMatch(deploy, /npm ci|\brelease\s+--\s+(?:build|package|publish)\b/);
});

test('seal is atomic and deploy consumes it without downloading or rebuilding', async () => {
  const [agent, engine, oss] = await Promise.all([
    source('04_tools/release-engine/remote/agent.mjs'),
    source('04_tools/release-engine/src/engine.mjs'),
    source('04_tools/release-engine/src/oss.mjs'),
  ]);
  assert.match(agent, /writeAtomicJson\(join\(context\.deployment\.pointerRoot, 'candidate-seal\.json'\), value\)/);
  assert.match(agent, /assert\(seal, 'CANDIDATE_SEAL_MISSING'/);
  assert.match(agent, /cacheStatus: 'sealed_candidate'/);
  assert.match(agent, /downloadedBytes: 0/);
  assert.match(agent, /await atomicPointer\(join\(root, 'current'\), candidate\)/);
  assert.match(agent, /CUTOVER_FAILED_AND_ROLLED_BACK/);
  assert.match(oss, /putImmutable\(archiveObject/);
  assert.match(oss, /PREVIOUS_RELEASE_INDEX = 'release-index-r3-normalized-runtime-modes\.json'/);
  assert.match(oss, /ARTIFACT_RECIPE = 'r4-seal-lifecycle'/);
  assert.match(oss, /CURRENT_RELEASE_INDEX = `release-index-\$\{ARTIFACT_RECIPE\}\.json`/);
  const sealAuthority = engine.indexOf('const authoritativeSeal = candidateOnly ? null : manifestSealControlSha');
  const remoteExecution = engine.indexOf('const remote = await runCommand(', sealAuthority);
  assert.ok(sealAuthority >= 0, 'prepared deploy must require the authoritative OSS Seal');
  assert.ok(remoteExecution > sealAuthority, 'prepared deploy must require the OSS Seal before any remote execution');
});

test('public pull requests have no trigger path to self-hosted runners', async () => {
  const paths = [
    ...fixture.entries.official.workflows.map(({ path }) => path),
    ...fixture.entries.disasterRecovery.map(({ path }) => path),
    ...fixture.entries.pureHistory.map(({ path }) => path),
    ...fixture.entries.diagnostics.map(({ path }) => path),
  ];
  for (const path of paths) {
    const definition = await source(path);
    for (const trigger of ['pull_request', 'pull_request_target', 'issue_comment', 'workflow_run', 'repository_dispatch']) {
      assert.doesNotMatch(definition, new RegExp(`^\\s{0,2}${trigger}:`, 'm'), `${path} unexpectedly accepts ${trigger}`);
    }
  }
  assert.equal(fixture.securityBoundary.untrustedPullRequestCanReachSelfHosted, false);
});

test('recovery is explicit and retired stubs remain inert', async () => {
  for (const { path } of fixture.entries.disasterRecovery) {
    const definition = await source(path);
    assert.match(definition, /^\s{2}workflow_dispatch:/m);
    assert.doesNotMatch(definition, /^\s{2}push:/m);
  }
  for (const { path, inert } of fixture.entries.pureHistory) {
    const definition = await source(path);
    if (inert) assert.match(definition, /if: \$\{\{ false \}\}/);
  }
});
