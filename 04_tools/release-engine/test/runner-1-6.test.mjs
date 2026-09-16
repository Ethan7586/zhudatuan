import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

import { aggregateStatus, observationDiagnostic, sourceFromIdentifier } from '../runner-1-6.mjs';
import { DeliveryError } from '../src/errors.mjs';
import { runCommand } from '../src/runner.mjs';
import { selectExecutionRunner } from '../src/runner-selection-1-6.mjs';
import { inspectSimpleArtifact, SIMPLE_RELEASE_SCHEMA, simpleReleaseObject } from '../src/simple-artifact-store.mjs';
import { digest, prettyStableJson, sha256 } from '../src/stable.mjs';

const root = resolve(new URL('../../..', import.meta.url).pathname);
const sha = 'a'.repeat(40);

test('Aliyun is selected only when a matching runner is online and idle', () => {
  const selected = selectExecutionRunner({
    runners: [
      {
        name: 'aliyun-1',
        status: 'online',
        busy: false,
        labels: ['self-hosted', 'Linux', 'X64', 'zdt-aliyun-build', 'zdt-aliyun-build-1'].map((name) => ({ name })),
      },
    ],
  });
  assert.equal(selected.runnerClass, 'aliyun');
  assert.deepEqual(selected.runsOn, ['self-hosted', 'Linux', 'X64', 'zdt-aliyun-build', 'zdt-aliyun-build-1']);
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

test('status keeps an unreadable observation UNKNOWN without hiding confirmed failure', () => {
  assert.equal(aggregateStatus(['HEALTHY', 'UNKNOWN']), 'UNKNOWN');
  assert.equal(aggregateStatus(['UNKNOWN', 'FAILED']), 'FAILED');
  assert.equal(aggregateStatus(['HEALTHY', 'ROLLED_BACK']), 'ROLLED_BACK');
  const unreadable = observationDiagnostic(new DeliveryError('COMMAND_FAILED', 'status failed', { exitCode: 255, outputTail: 'ssh unavailable' }));
  assert.equal(unreadable.remoteFailure, null);
  const unhealthy = observationDiagnostic(new DeliveryError('COMMAND_FAILED', 'verify failed', { exitCode: 1, outputTail: JSON.stringify({ ok: false, error: { code: 'READINESS_TIMEOUT', message: 'not ready' } }) }));
  assert.equal(unhealthy.remoteFailure.code, 'READINESS_TIMEOUT');
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
  const action = parse(await readFile(join(root, '.github/actions/runner-1-6/action.yml'), 'utf8'));
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.operation.options, ['release', 'status', 'retry', 'rollback', 'control-update']);
  assert.match(workflowSource, /runs-on: \$\{\{ fromJSON\(needs\.route\.outputs\.runs_on\) \}\}/);
  assert.equal(workflow.jobs.execute.steps.at(-1).uses, './.github/actions/runner-1-6');
  assert.equal(workflow.jobs['hosted-startup-fallback'].steps.at(-1).uses, './.github/actions/runner-1-6');
  assert.match(workflow.jobs['hosted-startup-fallback'].if, /core_started != 'true'/);
  assert.equal(action.outputs.started.value, '${{ steps.started.outputs.value }}');
  assert.ok(action.runs.steps.findIndex((step) => step.id === 'started') < action.runs.steps.findIndex((step) => String(step.run ?? '').includes('scripts/runner-1-6.sh')));
  assert.doesNotMatch(workflowSource, /final.?seal|closure|runner.?lease|writer.?lease|slot.?claim|readiness.?doctor|finalizer/i);
  assert.match(workflow.on.workflow_dispatch.inputs.release_target.description, /fast exact release\/retry/);
  assert.match(workflowSource, /exact release requires both target and physical node/);
  assert.match(workflowSource, /exact retry requires both target and physical node/);
});

test('control-side command only dispatches and queries GitHub', async () => {
  const dispatcher = await readFile(join(root, 'scripts/delivery-dispatch.sh'), 'utf8');
  const controller = await readFile(join(root, '02_platform_pingtai/infrastructure/github-actions-runner/zdt-delivery'), 'utf8');
  assert.match(dispatcher, /workflow='delivery-1-6\.yml'/);
  assert.match(dispatcher, /gh workflow run/);
  assert.match(dispatcher, /\^r16-\[0-9a-f\]\{40\}\$/);
  assert.doesNotMatch(`${dispatcher}\n${controller}`, /npm ci|npm run|\bssh\b|\bscp\b|runner-1-6\.mjs/);
});

test('shared core keeps SSH material isolated to the current runner invocation', async () => {
  const shell = await readFile(join(root, 'scripts/runner-1-6.sh'), 'utf8');
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  assert.match(shell, /mktemp -d/);
  assert.match(shell, /trap cleanup EXIT/);
  assert.doesNotMatch(shell, /\$HOME\/\.ssh/);
  assert.match(core, /UserKnownHostsFile=/);
  assert.match(core, /IdentitiesOnly=yes/);
});

test('normal path uses direct artifact deployment and does not depend on old authorities', async () => {
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  const shell = await readFile(join(root, 'scripts/runner-1-6.sh'), 'utf8');
  const agent = await readFile(join(root, '04_tools/release-engine/remote/agent.mjs'), 'utf8');
  assert.match(core, /deploy-oss-direct-v2/);
  assert.match(core, /previous/);
  assert.match(core, /rollback/);
  assert.doesNotMatch(core, /from '.\/src\/(?:engine|oss)\.mjs'/);
  assert.doesNotMatch(`${core}\n${shell}`, /final.?seal|closure|writer.?lease|runner.?lease|slot.?claim|readiness.?doctor/i);
  assert.doesNotMatch(agent, /seal-validated-candidate|deploy-sealed-candidate|register-current-baseline/);
  assert.doesNotMatch(agent, /withLocks|acquireDirectoryLock|DELIVERY_LOCKED|lockRoot|staleLockSeconds|owner\.json/);
  assert.match(agent, /CUTOVER_SUPERSEDED/);
  for (const obsolete of [
    '.github/workflows/delivery-1-4-3.yml',
    '.github/workflows/auto-prepare-artifacts.yml',
    '.github/workflows/prepare-artifact-aliyun.yml',
    '.github/workflows/deploy-prepared-aliyun.yml',
    '.github/workflows/deploy-source-aliyun.yml',
    '.github/workflows/deploy-oss.yml',
    '.github/workflows/deploy-prepared.yml',
    '.github/workflows/prepare-artifact.yml',
    '.github/workflows/register-current-baseline.yml',
    '.github/workflows/register-current-baseline-aliyun.yml',
    '.github/workflows/legacy-direct-recovery-aliyun.yml',
    '04_tools/release-engine/cli.mjs',
    '04_tools/release-engine/src/engine.mjs',
    '04_tools/release-engine/src/seal-lifecycle.mjs',
    '04_tools/release-engine/src/seal-recovery.mjs',
    '04_tools/release-engine/src/release-writer-lease.mjs',
  ]) {
    await assert.rejects(access(join(root, obsolete)));
  }
});

test('exact production cutover skips dependencies and build and reports the one-minute objective', async () => {
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  const exactBranch = core.indexOf('if (exactScope) return deployExact');
  const dependencyInstall = core.indexOf("name: 'install-control-dependencies'");
  const exactFunction = core.indexOf('async function deployExact');
  assert.ok(exactBranch > 0 && exactBranch < dependencyInstall && exactFunction > dependencyInstall);
  const exactSource = core.slice(exactFunction, core.indexOf('async function deployTarget'));
  assert.doesNotMatch(exactSource, /npm|buildRelease|packageRelease|createReleasePlan/);
  assert.match(exactSource, /ARTIFACT_NOT_READY/);
  assert.match(exactSource, /productionSloMs: 60_000/);
  assert.match(exactSource, /productionDurationMs <= 60_000/);
});

test('control update uses the shared core and changes no business pointer or service', async () => {
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  const updateStart = core.indexOf('async function updateRemoteControl');
  const updateEnd = core.indexOf('async function status');
  const update = core.slice(updateStart, updateEnd);
  assert.match(update, /remoteControlUpdateScript/);
  assert.match(update, /node --check/);
  assert.match(update, /mktemp --suffix=\.mjs/);
  assert.doesNotMatch(update, /\b(?:current|previous|restart|systemctl|lock|lease|seal)\b/i);
});

test('remote policy contains no lock or unlock authority', async () => {
  const policy = await readFile(join(root, '02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json'), 'utf8');
  assert.doesNotMatch(policy, /lockRoot|staleLockSeconds|owner\.json/i);
});

test('release installs dependencies before dynamic impact planning', async () => {
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  const release = core.slice(core.indexOf('async function release'), core.indexOf('async function installDependencies'));
  assert.ok(release.indexOf('await installDependencies') < release.indexOf('const plan = await createReleasePlan'));
  assert.match(core, /name: 'install-control-dependencies'/);
  assert.match(core, /name: 'install-source-dependencies'/);
  assert.match(core, /resolve\(controlRoot\) !== resolve\(adapter\.projectRoot\)/);
});

test('status installs the dynamic impact dependencies instead of failing before observation', async () => {
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  const status = core.slice(core.indexOf('async function status'), core.indexOf('async function rollback'));
  assert.ok(status.indexOf('await installDependencies') < status.indexOf('const plan = await createReleasePlan'));
});

test('isolated legacy recovery has no concurrency lock', async () => {
  const recovery = await readFile(join(root, '.github/workflows/legacy-oss-recovery-aliyun.yml'), 'utf8');
  assert.doesNotMatch(recovery, /^concurrency:|cancel-in-progress:|^\s+group:/m);
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

test('production frontend builds receive their existing required environment', async () => {
  const release = JSON.parse(await readFile(join(root, '02_platform_pingtai/infrastructure/release/zdt-next.release.json'), 'utf8'));
  assert.equal(release.targets['auth-web'].build[0].environment.VITE_CLIENT_VERSION, '0.0.0-g{{sourceSha}}');
  assert.deepEqual(release.targets.console.build[0].environment, {
    VITE_API_BASE_URL: 'https://api.hbbtzn.com',
    VITE_AUTH_BASE_URL: 'https://accounts.hbbtzn.com',
    VITE_CLIENT_VERSION: '0.0.0-g{{sourceSha}}',
  });
});
