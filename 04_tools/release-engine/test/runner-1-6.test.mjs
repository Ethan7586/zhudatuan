import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { parse } from 'yaml';

import { deploymentState, observationDiagnostic, observedTarget, remoteRuntimeSyncScript, runnerFailureReceipt, selectedWorkspaces, sourceFromIdentifier, sourceInstallArguments } from '../runner-1-6.mjs';
import { loadAdapter } from '../src/adapter.mjs';
import { typecheckCacheDirectory } from '../src/build-core-1-6.mjs';
import { DeliveryError } from '../src/errors.mjs';
import { expandArgv, runCommand } from '../src/runner.mjs';
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

test('source install selects build workspaces without changing migration impact ownership', () => {
  const adapter = { targets: { identity: { workspace: '@shop/commerce' }, jobs: { workspace: '@shop/commerce' }, migration: { kind: 'migration', buildWorkspace: '@shop/commerce' }, console: { workspace: '@shop/console' }, content: {} } };
  assert.deepEqual(selectedWorkspaces(adapter, ['identity']), ['@shop/commerce']);
  assert.deepEqual(selectedWorkspaces(adapter, ['identity', 'jobs', 'console']), ['@shop/commerce', '@shop/console']);
  assert.deepEqual(selectedWorkspaces(adapter, ['migration']), ['@shop/commerce']);
  assert.deepEqual(selectedWorkspaces(adapter, ['identity', 'content']), []);
});

test('console cold install omits unrelated root tools without changing other targets', () => {
  const base = ['npm', 'ci', '--ignore-scripts'];
  assert.deepEqual(sourceInstallArguments(base, ['@shop/console']), [...base, '--workspace', '@shop/console']);
  assert.deepEqual(sourceInstallArguments(base, ['@shop/commerce']), [...base, '--workspace', '@shop/commerce', '--include-workspace-root']);
  assert.deepEqual(sourceInstallArguments(base, ['@shop/console', '@shop/commerce']), [...base, '--workspace', '@shop/console', '--workspace', '@shop/commerce', '--include-workspace-root']);
  assert.deepEqual(sourceInstallArguments(base, []), base);
});

test('commerce and console typechecks use per-runner TypeScript cache paths', async () => {
  const adapter = await loadAdapter('02_platform_pingtai/infrastructure/release/zdt-next.release.json');
  const cacheDirectory = typecheckCacheDirectory('/runner/work/repo/.runner-1-6/source', '/runner/work/repo');
  assert.equal(cacheDirectory, '/runner/work/repo/.runner-1-6');
  assert.equal(typecheckCacheDirectory('/local/repo', ''), '/local/repo/node_modules');
  const commerceTargets = Object.keys(adapter.targets).filter((target) => adapter.targets[target].typecheck.some((command) => command.name === 'commerce-typecheck'));
  assert.ok(commerceTargets.length > 1);
  for (const [target, filename] of [...commerceTargets.map((target) => [target, 'commerce.tsbuildinfo']), ['console', 'console.tsbuildinfo']]) {
    const command = adapter.targets[target].typecheck[0];
    const argv = expandArgv(command.argv, { typecheckCacheDirectory: cacheDirectory });
    assert.deepEqual(argv.slice(-4), ['--', '--incremental', '--tsBuildInfoFile', `${cacheDirectory}/${filename}`]);
    assert.equal(command.name.endsWith('-typecheck'), true);
  }
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

test('portable self-hosted Runner is selectable while Aliyun remains first', () => {
  const portable = { name: 'gcp-build', status: 'online', busy: false, labels: ['self-hosted', 'Linux', 'X64', 'zdt-build', 'zdt-build-2'] };
  const aliyun = { name: 'aliyun-build', status: 'online', busy: false, labels: ['self-hosted', 'Linux', 'X64', 'zdt-aliyun-build'] };
  const selected = selectExecutionRunner({ runners: [portable] });
  assert.equal(selected.runnerClass, 'self-hosted');
  assert.equal(selected.runnerName, 'gcp-build');
  assert.deepEqual(selected.runsOn, ['self-hosted', 'Linux', 'X64', 'zdt-build', 'zdt-build-2']);
  assert.equal(selectExecutionRunner({ runners: [portable, aliyun] }).runnerName, 'aliyun-build');
  assert.equal(selectExecutionRunner({ runners: [{ ...aliyun, busy: true }, portable] }).runnerName, 'gcp-build');
});

for (const [name, observation, reason] of [
  ['missing', { runners: [] }, 'self-hosted-runner-missing'],
  ['offline', { runners: [{ status: 'offline', busy: false, labels: ['zdt-aliyun-build'] }] }, 'self-hosted-runner-offline'],
  ['busy', { runners: [{ status: 'online', busy: true, labels: ['zdt-aliyun-build'] }] }, 'self-hosted-runner-busy'],
  ['unreadable', { error: 'forbidden' }, 'self-hosted-status-unavailable'],
])
  test(`GitHub Hosted is selected when self-hosted capacity is ${name}`, () => {
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

test('status keeps failure diagnostics without hiding remote evidence', () => {
  const unreadable = observationDiagnostic(new DeliveryError('COMMAND_FAILED', 'status failed', { exitCode: 255, outputTail: 'ssh unavailable' }));
  assert.equal(unreadable.remoteFailure, null);
  const unhealthy = observationDiagnostic(new DeliveryError('COMMAND_FAILED', 'verify failed', { exitCode: 1, outputTail: JSON.stringify({ ok: false, error: { code: 'READINESS_TIMEOUT', message: 'not ready' } }) }));
  assert.equal(unhealthy.remoteFailure.code, 'READINESS_TIMEOUT');
});

test('manual rollback failure receipt exposes the final target state', () => {
  const remoteFailure = {
    ok: false,
    error: {
      code: 'ROLLBACK_FAILED',
      details: {
        rollbackFailure: { code: 'READINESS_TIMEOUT' },
        current: '/releases/previous',
        previous: '/releases/original',
        serviceStatus: { activeState: 'failed' },
        nextAction: 'Run status and recover manually.',
      },
    },
  };
  const receipt = runnerFailureReceipt(
    new DeliveryError('COMMAND_FAILED', 'rollback failed', { exitCode: 1, outputTail: JSON.stringify(remoteFailure) }),
    { operation: 'rollback', stage: 'rollback', sourceSha: sha, target: 'app', node: 'local', completedTargets: [] },
  );
  assert.equal(receipt.current, '/releases/previous');
  assert.equal(receipt.previous, '/releases/original');
  assert.equal(receipt.serviceStatus.activeState, 'failed');
  assert.equal(receipt.recovery.code, 'READINESS_TIMEOUT');
  assert.equal(receipt.nextAction, 'Run status and recover manually.');
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
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.operation.options, ['release', 'status', 'retry', 'rollback']);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.execution_location.options, ['auto', 'github-hosted']);
  assert.match(workflowSource, /runs-on: \$\{\{ fromJSON\(needs\.route\.outputs\.runs_on\) \}\}/);
  assert.match(workflowSource, /needs\.route\.outputs\.runner_class == 'self-hosted'/);
  for (const job of [workflow.jobs.execute, workflow.jobs['hosted-startup-fallback']]) {
    const cores = job.steps.filter((step) => String(step.uses ?? '').endsWith('/.github/actions/runner-1-6'));
    assert.equal(cores.length, 4);
    assert.equal(cores.filter((step) => step.with.phase === 'prepare').length, 2);
    assert.equal(cores.filter((step) => step.with.phase === 'run').length, 2);
    const exactPrepare = cores.find((step) => step.with.phase === 'prepare' && step.with.operation === '${{ inputs.operation }}');
    const exactRun = cores.find((step) => step.with.phase === 'run' && step.with.operation === '${{ inputs.operation }}');
    assert.equal(exactPrepare.with.target, '${{ inputs.release_target }}');
    assert.equal(exactRun.with.target, '${{ inputs.release_target }}');
    assert.equal(exactRun.with['physical-node'], '${{ inputs.physical_node }}');
    assert.equal(exactPrepare.with['source-sha'], '${{ needs.route.outputs.source_sha }}');
    assert.equal(exactRun.with['source-sha'], '${{ needs.route.outputs.source_sha }}');
    assert.deepEqual(new Set(cores.map((step) => step.uses)), new Set([
      './.runner-1-6/control-release/.github/actions/runner-1-6',
      './.runner-1-6/status-control/.github/actions/runner-1-6',
    ]));
    const marker = job.steps.findIndex((step) => step.name === 'Mark shared release core started');
    assert.ok(marker > job.steps.findIndex((step) => step.with?.phase === 'prepare'));
    assert.ok(marker < job.steps.findIndex((step) => step.with?.phase === 'run'));
    assert.equal(job.env.ALIYUN_OSS_ENDPOINT, '${{ secrets.ALIYUN_OSS_ENDPOINT }}');
    assert.equal(job.env.ZDT_RELEASE_SSH_KEY, '${{ secrets.ZDT_RELEASE_SSH_KEY }}');
    assert.equal(job.env.CONTROL_SHA, '${{ github.sha }}');
    const releaseCheckout = job.steps.find((step) => step.with?.path === '.runner-1-6/control-release');
    assert.match(releaseCheckout.with['sparse-checkout'], /04_tools\/release-engine/);
  }
  assert.match(workflow.jobs['hosted-startup-fallback'].if, /core_started != 'true'/);
  assert.equal(workflow.jobs.execute.outputs.core_started, '${{ steps.started.outputs.value }}');
  assert.match(action.runs.steps.find((step) => String(step.run ?? '').includes('scripts/runner-1-6.sh')).if, /inputs.phase == 'run'/);
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
  assert.match(dispatcher, /dispatch_run "\$self_hosted_run_id" github-hosted/);
  assert.match(dispatcher, /\^r16-\[0-9a-f\]\{40\}\$/);
  assert.match(dispatcher, /DELIVERY_COMMAND_RETURN_MS=/);
  const readme = await readFile(join(root, '02_platform_pingtai/infrastructure/github-actions-runner/README.md'), 'utf8');
  assert.match(readme, /Direct dispatch from GitHub's Actions page bypasses/);
  assert.doesNotMatch(`${dispatcher}\n${controller}`, /npm ci|npm run|\bssh\b|\bscp\b|runner-1-6\.mjs/);
});

test('team entry and dispatcher no longer expose a standalone remote update operation', async () => {
  for (const path of [
    '02_platform_pingtai/infrastructure/github-actions-runner/zdt-delivery',
    'scripts/delivery-dispatch.sh',
  ]) {
    await assert.rejects(
      execFileAsync('bash', [join(root, path), 'control-update'], { cwd: root }),
      (error) => error.code === 64
    );
  }
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
  const exactBranch = core.indexOf('if (exactScope) {');
  const dependencyInstall = core.indexOf("name: 'install-control-dependencies'");
  const exactFunction = core.indexOf('async function deployExact');
  assert.ok(exactBranch > 0 && exactBranch < dependencyInstall && exactFunction > dependencyInstall);
  const exactSource = core.slice(exactFunction, core.indexOf('async function deployExactBatch'));
  assert.match(exactSource, /if \(!cached\.exists\)/);
  assert.match(exactSource, /createReleasePlan\(adapter, \{ from: `\$\{sourceSha\}\^`, to: sourceSha, target, prepare: true \}\)/);
  assert.match(exactSource, /await buildAndPublish\(adapter, controlRoot, plan, client, \{ sourceSha, target, node \}\)/);
  assert.ok(exactSource.indexOf('await buildAndPublish') < exactSource.indexOf('await deployTarget'));
  assert.ok(exactSource.indexOf('await syncRemoteRuntime(adapter, controlRoot)') > exactSource.indexOf('await buildAndPublish'));
  assert.ok(exactSource.indexOf('await syncRemoteRuntime(adapter, controlRoot)') < exactSource.indexOf('await deployTarget'));
  assert.match(exactSource, /cacheStatus: 'reused'|let cacheStatus = 'reused'/);
  assert.doesNotMatch(exactSource, /physicalPlacements\(adapter/);
  assert.match(exactSource, /coreDurationMs/);
  assert.doesNotMatch(exactSource, /productionSlo/);
});

test('normal release installs its own remote core once before the first target, while status stays read-only', async () => {
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  const release = core.slice(core.indexOf('async function release('), core.indexOf('async function deployExact('));
  assert.equal((release.match(/await syncRemoteRuntime\(adapter, controlRoot\)/g) ?? []).length, 1);
  assert.ok(release.indexOf('await syncRemoteRuntime(adapter, controlRoot)') > release.indexOf('await buildAndPublish'));
  assert.ok(release.indexOf('await syncRemoteRuntime(adapter, controlRoot)') < release.indexOf('for (const deploymentTarget'));
  const status = core.slice(core.indexOf('async function status('), core.indexOf('async function rollback('));
  assert.doesNotMatch(status, /syncRemoteRuntime/);
});

test('remote runtime sync is internal to release and changes no business pointer or service', async () => {
  const core = await readFile(join(root, '04_tools/release-engine/runner-1-6.mjs'), 'utf8');
  const updateStart = core.indexOf('async function syncRemoteRuntime');
  const updateEnd = core.indexOf('async function status');
  const update = core.slice(updateStart, updateEnd);
  assert.match(update, /progress\('remote-sync-complete'/);
  assert.match(update, /remoteRuntimeSyncScript/);
  assert.match(update, /return `\/usr\/local\/lib\/ai-delivery\/versions\/\$\{agentSha256\}-\$\{policySha256\}\/agent\.mjs`/);
  assert.match(update, /node --check/);
  assert.match(update, /versions\/\.stage/);
  assert.match(update, /mv -Tf "\$agent_link"/);
  assert.doesNotMatch(update, /\b(?:current|previous|restart|systemctl|lock|lease|seal)\b/i);
  assert.doesNotMatch(core, /options\.operation === 'control-update'|expected-remote-agent-sha256|expected-remote-policy-sha256/);
  const agent = await readFile(join(root, '04_tools/release-engine/remote/agent.mjs'), 'utf8');
  assert.doesNotMatch(agent, /assertExpectedPreparedControlPlane|REMOTE_AGENT_SHA256_MISMATCH|REMOTE_POLICY_SHA256_MISMATCH/);
});

test('remote runtime sync stages a matching Agent/policy pair before one atomic entry switch', () => {
  const script = remoteRuntimeSyncScript({ agent: Buffer.from('export {};').toString('base64'), policy: Buffer.from('{"schema":"ai.delivery.remote-policy.v1","project":"zdt-next"}').toString('base64'), agentSha256: 'a'.repeat(64), policySha256: 'b'.repeat(64) });
  execFileSync('bash', ['-n'], { input: script });
  assert.match(script, /versions\/a{64}-b{64}/);
  assert.match(script, /sha256sum "\$version_dir\/agent\.mjs"/);
  assert.match(script, /sha256sum "\$version_dir\/zdt-next\.json"/);
  assert.match(script, /mv -Tf "\$agent_link" \/usr\/local\/lib\/ai-delivery\/agent\.mjs/);
  assert.doesNotMatch(script, /mv -f "\$policy_tmp"/);
});

test('independent recovery verifies the active versioned Agent and its adjacent policy', async () => {
  const installer = await readFile(join(root, '02_platform_pingtai/infrastructure/release/install-ai-delivery-agent.sh'), 'utf8');
  assert.match(installer, /readlink -f "\$installed_agent"/);
  assert.match(installer, /dirname "\$installed_agent"\)\/zdt-next\.json/);
  assert.match(installer, /else\n    cmp -s "\$agent_source" "\$installed_agent"\n    cmp -s "\$policy_source" \/etc\/ai-delivery\/projects\/zdt-next\.json/);
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

test('status and rollback can load target placements despite unrelated build configuration damage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'runner-observation-adapter-'));
  try {
    const path = join(directory, 'adapter.json');
    await writeFile(path, JSON.stringify({ schema: 'ai.delivery.project.v1', project: 'fixture', targets: { app: { tests: 'broken-unrelated-build-shape' } }, nodes: { local: { deployments: { app: { pointerRoot: '/opt/app', service: 'app.service' } } } } }));
    const observed = await loadAdapter(path, directory, { observationOrRecovery: true });
    assert.equal(observed.nodes.local.deployments.app.pointerRoot, '/opt/app');
    await assert.rejects(loadAdapter(path, directory), /stateDirectory/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('live observation distinguishes current, previous and unrelated source without calling them failures', () => {
  const observation = (current, previous) => ({ status: { currentArtifact: { sourceSha: current }, previousArtifact: { sourceSha: previous } }, verification: { readiness: { status: 'ready' } } });
  assert.equal(observedTarget(null, 'identity-api', 'hbbtzn-l1', observation(sha, 'b'.repeat(40))).state, 'HEALTHY');
  assert.equal(observedTarget(null, 'identity-api', 'hbbtzn-l1', observation(sha, 'b'.repeat(40))).currentSourceSha, sha);
  assert.equal(observedTarget(sha, 'identity-api', 'hbbtzn-l1', observation(sha, 'b'.repeat(40))).state, 'HEALTHY');
  const unchecked = { ...observation(sha, 'b'.repeat(40)), verification: { readiness: { status: 'not-checked', checks: [] } } };
  assert.equal(observedTarget(sha, 'console', 'zhudatuan-l0', unchecked).state, 'CURRENT');
  const oldAgent = { ...observation(sha, 'b'.repeat(40)), verification: { readiness: { status: 'ready', attempts: 0, checks: [] } } };
  assert.equal(observedTarget(sha, 'console', 'zhudatuan-l0', oldAgent).state, 'CURRENT');
  assert.equal(observedTarget(sha, 'console', 'zhudatuan-l0', oldAgent).health.status, 'not-checked');
  assert.equal(deploymentState([{ health: { status: 'ready' } }]), 'HEALTHY');
  assert.equal(deploymentState([{ health: { status: 'not-checked' } }]), 'DEPLOYED');
  assert.equal(deploymentState([{ health: { status: 'ready' } }, { health: { status: 'not-checked' } }]), 'DEPLOYED');
  assert.equal(observedTarget(sha, 'identity-api', 'hbbtzn-l1', observation('b'.repeat(40), sha)).state, 'PREVIOUS');
  assert.equal(observedTarget(sha, 'identity-api', 'hbbtzn-l1', observation('b'.repeat(40), 'c'.repeat(40))).state, 'OTHER');
  assert.equal(observedTarget(sha, 'identity-api', 'hbbtzn-l1', null).state, 'UNKNOWN');
  const unreadable = { ...observation(sha, 'b'.repeat(40)), error: { code: 'SERVICE_UNREADABLE' } };
  assert.equal(observedTarget(sha, 'identity-api', 'hbbtzn-l1', unreadable).state, 'FAILED');
  const uninitialized = { status: { currentArtifact: null, previousArtifact: null }, error: { code: 'CURRENT_POINTER_MISSING' } };
  assert.equal(observedTarget(sha, 'catalog-media', 'hbbtzn-l1', uninitialized).state, 'EMPTY');
});

test('L0 console route serves the active Runner pointer, not the obsolete monolith directory', async () => {
  const caddy = await readFile(join(root, '02_platform_pingtai/infrastructure/zhudatuan/aliyun/Caddyfile'), 'utf8');
  const policy = JSON.parse(await readFile(join(root, '02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json'), 'utf8'));
  const consoleRoot = policy.nodes['zhudatuan-l0'].deployments.console.pointerRoot;
  assert.match(caddy, new RegExp(`root \\* ${consoleRoot}/current/static`));
});

test('isolated legacy recovery has no concurrency lock', async () => {
  const recovery = await readFile(join(root, '.github/workflows/legacy-oss-recovery-aliyun.yml'), 'utf8');
  assert.doesNotMatch(recovery, /^concurrency:|cancel-in-progress:|^\s+group:/m);
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

test('Runner host scripts do not recreate the old build lock or bind installation to the old ECS', async () => {
  const directory = join(root, '02_platform_pingtai/infrastructure/github-actions-runner');
  const capacity = await readFile(join(directory, 'install-build-capacity-policy.sh'), 'utf8');
  assert.match(capacity, /rm -f -- \/etc\/tmpfiles\.d\/zdt-build-lock\.conf \/run\/lock\/zdt-build\/heavy\.lock/);
  assert.doesNotMatch(capacity, /install .*heavy\.lock|zdt-builders|SupplementaryGroups/);
  for (const setting of ['ZDT_BUILD_CPU_QUOTA', 'ZDT_BUILD_MEMORY_HIGH', 'ZDT_BUILD_MEMORY_MAX']) assert.match(capacity, new RegExp(setting));
  for (const name of ['install-build-capacity-policy.sh', 'install-build-slot-2.sh', 'install-release-standby.sh', 'switch-release-runner.sh']) {
    const script = await readFile(join(directory, name), 'utf8');
    assert.doesNotMatch(script, /i-2zeewhay0farxq8lucrc|EXPECTED_INSTANCE_ID/);
  }
});
