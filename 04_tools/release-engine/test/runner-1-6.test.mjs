import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { parse } from 'yaml';

import { aggregateStatus, observationDiagnostic, observedTarget, selectedWorkspaces, sourceFromIdentifier } from '../runner-1-6.mjs';
import { DeliveryError } from '../src/errors.mjs';
import { runCommand } from '../src/runner.mjs';
import { selectExecutionRunner } from '../src/runner-selection-1-6.mjs';
import { inspectSimpleArtifact, SIMPLE_RELEASE_SCHEMA, simpleReleaseObject } from '../src/simple-artifact-store.mjs';
import { digest, prettyStableJson, sha256 } from '../src/stable.mjs';

const root = resolve(new URL('../../..', import.meta.url).pathname);
const sha = 'a'.repeat(40);
const execFileAsync = promisify(execFile);

test('control dependencies are isolated to the small release-engine package', async () => {
  const engine = JSON.parse(await readFile(join(root, '04_tools/release-engine/package.json')));
  const lock = JSON.parse(await readFile(join(root, '04_tools/release-engine/package-lock.json')));
  assert.deepEqual(Object.keys(engine.dependencies).sort(), ['@alicloud/cdn20180510', '@alicloud/openapi-client', 'esbuild']);
  assert.deepEqual(lock.packages[''].dependencies, engine.dependencies);
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  assert.match(core, /projectRoot: engineRoot/);
});

test('source install selects only affected workspaces and falls back to full source when needed', () => {
  const adapter = { targets: { identity: { workspace: '@shop/commerce' }, jobs: { workspace: '@shop/commerce' }, console: { workspace: '@shop/console' }, content: {} } };
  assert.deepEqual(selectedWorkspaces(adapter, ['identity']), ['@shop/commerce']);
  assert.deepEqual(selectedWorkspaces(adapter, ['identity', 'jobs', 'console']), ['@shop/commerce', '@shop/console']);
  assert.deepEqual(selectedWorkspaces(adapter, ['identity', 'content']), []);
});

test('failed release emits control identity and a useful next action', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [join(root, '04_tools/release-engine/runner-1-6.mjs'), 'release', '--identifier', 'invalid', '--control-root', root], {
      env: { ...process.env, CONTROL_SHA: 'f'.repeat(40) },
    }),
    (error) => {
      const line = error.stderr.split('\n').find((item) => item.startsWith('RUNNER_1_6_RESULT='));
      const result = JSON.parse(line.slice('RUNNER_1_6_RESULT='.length));
      assert.equal(result.state, 'FAILED');
      assert.equal(result.controlSha, 'f'.repeat(40));
      assert.equal(result.code, 'SOURCE_SHA_REQUIRED');
      assert.match(result.nextAction, /full Source SHA/);
      return true;
    }
  );
});

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
  assert.equal(workflow.name, 'Delivery Control 1.7');
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.operation.options, ['release', 'status', 'retry', 'rollback', 'control-update']);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.execution_location.options, ['auto', 'github-hosted']);
  assert.match(workflowSource, /runs-on: \$\{\{ fromJSON\(needs\.route\.outputs\.runs_on\) \}\}/);
  for (const job of [workflow.jobs.execute, workflow.jobs['hosted-startup-fallback']]) {
    const cores = job.steps.filter((step) => String(step.uses ?? '').endsWith('/.github/actions/runner-1-6'));
    assert.equal(cores.length, 2);
    assert.deepEqual(new Set(cores.map((step) => step.uses)), new Set([
      './.runner-1-6/control-release/.github/actions/runner-1-6',
      './.runner-1-6/status-control/.github/actions/runner-1-6',
    ]));
    assert.equal(job.env.ALIYUN_OSS_ENDPOINT, '${{ secrets.ALIYUN_OSS_ENDPOINT }}');
    assert.equal(job.env.ZDT_RELEASE_SSH_KEY, '${{ secrets.ZDT_RELEASE_SSH_KEY }}');
    assert.equal(job.env.CONTROL_SHA, '${{ github.sha }}');
    const releaseCheckout = job.steps.find((step) => step.with?.path === '.runner-1-6/control-release');
    assert.match(releaseCheckout.with['sparse-checkout'], /04_tools\/release-engine/);
  }
  assert.match(workflow.jobs['hosted-startup-fallback'].if, /core_started != 'true'/);
  assert.equal(action.outputs.started.value, '${{ steps.started.outputs.value }}');
  assert.ok(action.runs.steps.findIndex((step) => step.id === 'started') < action.runs.steps.findIndex((step) => String(step.run ?? '').includes('scripts/runner-1-6.sh')));
  assert.match(action.runs.steps.find((step) => String(step.run ?? '').includes('scripts/runner-1-6.sh')).run, /bash "\$CONTROL_ROOT\/scripts\/runner-1-6\.sh"/);
  assert.doesNotMatch(workflowSource, /final.?seal|closure|runner.?lease|writer.?lease|slot.?claim|readiness.?doctor|finalizer/i);
  assert.match(workflow.on.workflow_dispatch.inputs.release_target.description, /fast exact release\/retry/);
  assert.match(workflowSource, /exact release requires both target and physical node/);
  assert.match(workflowSource, /exact retry requires both target and physical node/);
  const coreSource = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  assert.match(coreSource, /const client = simpleOssClientFromEnvironment\(\)/);
  assert.match(coreSource, /simpleDownloadEndpoint\(publicClient\.endpoint, process\.env\.ALIYUN_OSS_INTERNAL_ENDPOINT\)/);
});

test('Hosted shared action starts the checked-out control script from an empty workspace root', async () => {
  const action = parse(await readFile(join(root, '.github/actions/runner-1-6/action.yml'), 'utf8'));
  const script = action.runs.steps.find((step) => String(step.run ?? '').includes('scripts/runner-1-6.sh')).run
    .replace('${{ inputs.operation }}', 'status');
  const directory = await mkdtemp(join(tmpdir(), 'runner-hosted-action-'));
  const controlRoot = join(directory, 'control');
  await mkdir(join(controlRoot, 'scripts'), { recursive: true });
  await writeFile(join(controlRoot, 'scripts/runner-1-6.sh'), '#!/usr/bin/env bash\nprintf "CONTROL_SCRIPT=%s\\n" "$1"\n');
  try {
    const { stdout } = await execFileAsync('bash', ['-c', script], {
      cwd: directory,
      env: { ...process.env, CONTROL_ROOT: controlRoot },
    });
    assert.match(stdout, /CONTROL_SCRIPT=status/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('control-side command only dispatches and queries GitHub', async () => {
  const dispatcher = await readFile(join(root, 'scripts/delivery-dispatch.sh'), 'utf8');
  const controller = await readFile(join(root, '02_platform_pingtai/infrastructure/github-actions-runner/zdt-delivery'), 'utf8');
  assert.match(dispatcher, /workflow='delivery-1-6\.yml'/);
  assert.match(dispatcher, /gh workflow run/);
  assert.match(dispatcher, /gh run cancel/);
  assert.match(dispatcher, /core_steps.*-eq 0/);
  assert.match(dispatcher, /-f execution_location="\$execution_location"/);
  assert.match(dispatcher, /dispatch_run "\$aliyun_run_id" github-hosted/);
  assert.match(dispatcher, /\^r16-\[0-9a-f\]\{40\}\$/);
  assert.match(dispatcher, /DELIVERY_COMMAND_RETURN_MS=/);
  const readme = await readFile(join(root, '02_platform_pingtai/infrastructure/github-actions-runner/README.md'), 'utf8');
  assert.match(readme, /Direct dispatch from GitHub's Actions page bypasses/);
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

test('exact release builds only a missing target artifact before deploying one node', async () => {
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  const exactBranch = core.indexOf('if (exactScope) return deployExact');
  const dependencyInstall = core.indexOf("name: 'install-control-dependencies'");
  const exactFunction = core.indexOf('async function deployExact');
  assert.ok(exactBranch > 0 && exactBranch < dependencyInstall && exactFunction > dependencyInstall);
  const exactSource = core.slice(exactFunction, core.indexOf('async function deployTarget'));
  assert.match(exactSource, /if \(!cached\.exists\)/);
  assert.match(exactSource, /createReleasePlan\(adapter, \{ from: `\$\{sourceSha\}\^`, to: sourceSha, target, prepare: true \}\)/);
  assert.match(exactSource, /await buildAndPublish\(adapter, controlRoot, plan, client, \{ sourceSha, target, node \}\)/);
  assert.ok(exactSource.indexOf('await buildAndPublish') < exactSource.indexOf('await deployTarget'));
  assert.match(exactSource, /cacheStatus: 'reused'|let cacheStatus = 'reused'/);
  assert.doesNotMatch(exactSource, /physicalPlacements\(adapter/);
  assert.match(exactSource, /coreDurationMs/);
  assert.doesNotMatch(exactSource, /productionSlo/);
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

test('release installs dependencies only when a cache miss requires a build', async () => {
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  const release = core.slice(core.indexOf('async function release'), core.indexOf('async function installDependencies'));
  assert.ok(release.indexOf('const plan = await createReleasePlan') < release.indexOf('if (needsBuild)'));
  assert.match(release, /await buildAndPublish\(adapter, controlRoot, plan, client, \{ sourceSha, targets: plan\.deploymentOrder \}\)/);
  const sharedBuild = core.slice(core.indexOf('async function buildAndPublish'), core.indexOf('async function installDependencies'));
  assert.ok(sharedBuild.indexOf('await installDependencies') < sharedBuild.indexOf('await buildRelease'));
  assert.ok(sharedBuild.indexOf('await buildRelease') < sharedBuild.indexOf('await packageRelease'));
  assert.ok(sharedBuild.indexOf('await packageRelease') < sharedBuild.indexOf('await publishSimpleArtifacts'));
  assert.match(core, /name: 'install-control-dependencies'/);
  assert.match(core, /name: 'install-source-dependencies'/);
  assert.match(core, /engineRoot = join\(controlRoot, '04_tools\/release-engine'\)/);
  assert.match(core, /mode: workspaces\.length \? 'target-workspaces' : 'full-source'/);
  assert.match(core, /'--include-workspace-root'/);
  assert.match(core, /preparationTimings/);
  const serviceImpact = await readFile(join(root, '04_tools/release-engine/adapters/zdt-next/service-impact.mjs'), 'utf8');
  const workspaceImpact = await readFile(join(root, '04_tools/release-engine/adapters/zdt-next/workspace-impact.mjs'), 'utf8');
  assert.doesNotMatch(serviceImpact + workspaceImpact, /from ['"](?:esbuild|typescript|yaml)['"]/);
});

test('status observes configured physical nodes without source checkout or a release plan', async () => {
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  const status = core.slice(core.indexOf('async function status'), core.indexOf('async function rollback'));
  assert.doesNotMatch(status, /installDependencies|npm ci|createReleasePlan/);
  assert.match(status, /remoteObserveNode/);
  assert.match(status, /mode: 'one-connection-per-node'/);
  assert.match(status, /all-configured-placements/);
  const action = await readFile(join(root, '.github/actions/runner-1-6/action.yml'), 'utf8');
  assert.match(action, /inputs\.operation == 'release' \|\| inputs\.operation == 'retry'/);
  assert.doesNotMatch(action, /inputs\.target == ''/);
  const workflow = await readFile(join(root, '.github/workflows/delivery-1-6.yml'), 'utf8');
  assert.match(workflow, /inputs\.operation == 'status'/);
  assert.doesNotMatch(workflow, /filter: blob:none/);
  assert.match(workflow, /sparse-checkout:/);
  assert.match(workflow, /path: \.runner-1-6\/status-control/);
  assert.match(workflow, /path: \.runner-1-6\/control-release/);
  assert.match(workflow, /uses: \.\/\.runner-1-6\/status-control\/\.github\/actions\/runner-1-6/);
  assert.match(workflow, /uses: \.\/\.runner-1-6\/control-release\/\.github\/actions\/runner-1-6/);
  const impact = await readFile(join(root, '04_tools/release-engine/adapters/zdt-next/service-impact.mjs'), 'utf8');
  assert.doesNotMatch(impact, /(?:from|require\()['"]esbuild['"]/);
});

test('live observation distinguishes current, previous and unrelated source without calling them failures', () => {
  const observation = (current, previous) => ({ status: { currentArtifact: { sourceSha: current }, previousArtifact: { sourceSha: previous } }, verification: { readiness: { status: 'ready' } } });
  assert.equal(observedTarget(sha, 'identity-api', 'hbbtzn-l1', observation(sha, 'b'.repeat(40))).state, 'HEALTHY');
  assert.equal(observedTarget(sha, 'identity-api', 'hbbtzn-l1', observation('b'.repeat(40), sha)).state, 'PREVIOUS');
  assert.equal(observedTarget(sha, 'identity-api', 'hbbtzn-l1', observation('b'.repeat(40), 'c'.repeat(40))).state, 'OTHER');
  assert.equal(observedTarget(sha, 'identity-api', 'hbbtzn-l1', null).state, 'UNKNOWN');
  const unreadable = { ...observation(sha, 'b'.repeat(40)), error: { code: 'SERVICE_UNREADABLE' } };
  assert.equal(observedTarget(sha, 'identity-api', 'hbbtzn-l1', unreadable).state, 'FAILED');
  const uninitialized = { status: { currentArtifact: null, previousArtifact: null }, error: { code: 'CURRENT_POINTER_MISSING' } };
  assert.equal(observedTarget(sha, 'catalog-media', 'hbbtzn-l1', uninitialized).state, 'EMPTY');
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

test('Aliyun runners use a GitHub-only sing-box line without delivery locks', async () => {
  const directory = join(root, '02_platform_pingtai/infrastructure/github-actions-runner');
  const renderer = join(directory, 'render-github-singbox-config.mjs');
  const { stdout } = await execFileAsync(process.execPath, [renderer], {
    env: {
      ...process.env,
      ZDT_GITHUB_LINE_SERVER: 'line.example.test',
      ZDT_GITHUB_LINE_SERVER_PORT: '31001',
      ZDT_GITHUB_LINE_METHOD: 'aes-128-gcm',
      ZDT_GITHUB_LINE_PASSWORD: 'fixture-password',
    },
  });
  const config = JSON.parse(stdout);
  assert.deepEqual(config.inbounds[0], {
    type: 'mixed',
    tag: 'github-local',
    listen: '127.0.0.1',
    listen_port: 7890,
  });
  assert.equal(config.outbounds[0].tag, 'github-line');
  assert.equal(config.outbounds[1].tag, 'direct');
  assert.deepEqual(config.route.rules[0].domain_suffix, ['github.com', 'githubusercontent.com', 'githubassets.com', 'ghcr.io']);
  assert.equal(config.route.rules[0].action, 'route');
  assert.equal(config.route.final, 'direct');

  const installer = await readFile(join(directory, 'install-github-transport.sh'), 'utf8');
  assert.match(installer, /aliyun-staging-zdt-build-2\.service/);
  assert.match(installer, /pending-next-restart/);
  assert.doesNotMatch(installer, /exit 75|retry after it finishes|flock|lockRoot|\blease\b|\bclaim\b|\bseal\b/i);
});
