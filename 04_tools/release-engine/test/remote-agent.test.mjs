import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, chmod, copyFile, lstat, mkdir, mkdtemp, readFile, readlink, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { packageTarget, treeEvidence } from '../src/artifact.mjs';
import { digest } from '../src/stable.mjs';

const execFileAsync = promisify(execFile);
const agent = new URL('../remote/agent.mjs', import.meta.url).pathname;

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

test('stages, activates, rolls back and reports status with immutable releases', async () => {
  const fixture = await createFixture();
  const first = await createArtifact(fixture, 'first', 'a'.repeat(40));
  const staged = await invoke(fixture, 'stage', first);
  assert.ok(staged.result.timings.total >= 0);
  assert.equal((await lstat(staged.result.release)).mode & 0o777, 0o755);
  const preflight = await invoke(fixture, 'preflight', first);
  assert.equal(preflight.result.capacity.status, 'observed');
  assert.equal(preflight.result.artifact.sourceSha, first.sourceSha);
  assert.equal(preflight.result.rollbackPoint.pointers.current, null);
  const activated = await invoke(fixture, 'activate', first);
  assert.ok(activated.result.timings.health >= 0);
  assert.ok(activated.result.timings.total >= activated.result.timings.cutover);
  assert.equal(activated.result.restart.commandCount, 0);
  assert.equal(activated.result.receipt.schema, 'ai.delivery.receipt.v1');
  assert.equal(activated.result.receipt.finalStatus, 'success');
  assert.equal(activated.result.receipt.nonTargetProcesses.unchanged, null);
  assert.equal(activated.result.receipt.caddySemantic.unchanged, null);
  assert.equal(activated.result.receipt.automaticCleanup.status, 'not-observed-by-target-release');
  assert.equal(activated.result.receipt.capacity.status, 'observed');
  assert.equal(activated.result.receipt.rollbackPoint.status, 'pointer-based');
  assert.equal(activated.result.receipt.rollbackPoint.pointers.current, null);
  const firstCurrent = await readlink(join(fixture.pointerRoot, 'current'));
  assert.match(firstCurrent, new RegExp(first.treeDigest.slice(7)));

  const second = await createArtifact(fixture, 'second', 'b'.repeat(40));
  await invoke(fixture, 'stage', second);
  await invoke(fixture, 'activate', second);
  assert.match(await readlink(join(fixture.pointerRoot, 'current')), new RegExp(second.treeDigest.slice(7)));

  const rolledBack = await invoke(fixture, 'rollback', second);
  assert.equal(rolledBack.result.restart.commandCount, 0);
  assert.equal(await readlink(join(fixture.pointerRoot, 'current')), firstCurrent);

  await mkdir(join(fixture.pointerRoot, 'runtime'));
  const status = await invoke(fixture, 'status', second);
  assert.equal(status.result.current, firstCurrent);
  assert.equal(status.result.runtime, null);
  assert.equal('locks' in status.result, false);
  const verified = await invoke(fixture, 'verify', second);
  assert.equal(verified.result.current, firstCurrent);
  assert.equal(verified.result.checks.length, 1);
  const observed = await invokeObserve(fixture, ['app']);
  assert.equal(observed.result.targets[0].target, 'app');
  assert.equal(observed.result.targets[0].status.current, firstCurrent);
  assert.equal(observed.result.targets[0].verification.readiness.status, 'ready');
});

test('a versioned Agent symlink reads the policy bundled beside its actual code', async () => {
  const fixture = await createFixture();
  const version = join(fixture.root, 'version');
  await mkdir(version);
  await copyFile(agent, join(version, 'agent.mjs'));
  await writeFile(join(version, 'fixture.json'), JSON.stringify(fixture.policy));
  const entry = join(fixture.root, 'agent-link.mjs');
  await symlink(join(version, 'agent.mjs'), entry);
  const output = await execFileAsync(process.execPath, [entry, 'status', '--project', 'fixture', '--node', 'local', '--target', 'app'], { env: { ...process.env, AI_DELIVERY_POLICY_ROOT: join(fixture.root, 'obsolete-policy-root') } });
  assert.equal(JSON.parse(output.stdout).ok, true);
});

test('unrelated policy damage and obsolete advisory checks do not block status or rollback', async () => {
  const fixture = await createFixture();
  const first = await createArtifact(fixture, 'first', 'a'.repeat(40));
  await invoke(fixture, 'stage', first);
  await invoke(fixture, 'activate', first);
  const second = await createArtifact(fixture, 'second', 'b'.repeat(40));
  await invoke(fixture, 'stage', second);
  await invoke(fixture, 'activate', second);
  fixture.policy.nodes.peer.deployments.app.pointerRoot = 'broken-unrelated-path';
  fixture.policy.minimumFreeBytes = Number.MAX_SAFE_INTEGER;
  fixture.policy.caddyConfig = join(fixture.root, 'missing-Caddyfile');
  fixture.policy.lifecycleUnits = ['missing-fixture.timer'];
  await writePolicy(fixture);
  const observed = await invoke(fixture, 'status', second);
  assert.match(observed.result.current, new RegExp(second.treeDigest.slice(7)));
  const rolledBack = await invoke(fixture, 'rollback', second);
  assert.equal(rolledBack.result.readiness.status, 'ready');
  assert.match(rolledBack.result.current, new RegExp(first.treeDigest.slice(7)));
});

test('unwritable audit and obsolete capacity/Caddy checks cannot turn a healthy cutover into failure', async () => {
  const fixture = await createFixture();
  const auditFile = join(fixture.root, 'audit-is-a-file');
  await writeFile(auditFile, 'not-a-directory');
  fixture.policy.auditRoot = auditFile;
  fixture.policy.minimumFreeBytes = Number.MAX_SAFE_INTEGER;
  fixture.policy.caddyConfig = join(fixture.root, 'missing-Caddyfile');
  fixture.policy.lifecycleUnits = ['missing-fixture.timer'];
  await writePolicy(fixture);
  const artifact = await createArtifact(fixture, 'healthy', 'c'.repeat(40));
  await invoke(fixture, 'stage', artifact);
  const activated = await invoke(fixture, 'activate', artifact);
  assert.equal(activated.result.readiness.status, 'ready');
  assert.equal(activated.result.receipt.capacity.status, 'observed');
  assert.match(activated.result.current, new RegExp(artifact.treeDigest.slice(7)));
});

test('targets without configured health checks report not-checked without blocking activation or status', async () => {
  const fixture = await createFixture();
  fixture.policy.nodes.local.deployments.app.healthChecks = [];
  await writePolicy(fixture);
  const artifact = await createArtifact(fixture, 'static', 'a'.repeat(40));
  await invoke(fixture, 'stage', artifact);
  const activated = await invoke(fixture, 'activate', artifact);
  assert.equal(activated.result.readiness.status, 'not-checked');
  assert.equal(activated.result.receipt.finalStatus, 'success');
  const observed = await invokeObserve(fixture, ['app']);
  assert.equal(observed.result.targets[0].verification.readiness.status, 'not-checked');
  assert.equal(observed.result.targets[0].status.currentArtifact.sourceSha, artifact.sourceSha);
});

test('a killed activation leaves current, previous, status, retry and manual rollback usable', async () => {
  const fixture = await createFixture();
  const baseline = await createArtifact(fixture, 'healthy', '1'.repeat(40));
  await invoke(fixture, 'stage', baseline);
  await invoke(fixture, 'activate', baseline);
  const baselineCurrent = await readlink(join(fixture.pointerRoot, 'current'));

  const marker = join(fixture.root, 'candidate-health-started');
  fixture.policy.nodes.local.deployments.app.healthChecks = [{
    argv: [process.execPath, '-e', "const fs=require('node:fs');if(fs.readFileSync(process.argv[1],'utf8').trim()==='candidate'){fs.writeFileSync(process.argv[2],'started');setTimeout(()=>process.exit(0),2000)}", '{{currentDir}}/app.txt', marker],
  }];
  await writePolicy(fixture);
  const candidate = await createArtifact(fixture, 'candidate', '2'.repeat(40));
  await invoke(fixture, 'stage', candidate);
  const child = spawn(process.execPath, [agent, 'activate', '--project', 'fixture', '--node', 'local', '--target', 'app', '--approval', `fixture:${candidate.sourceSha}`, '--expected-current', baselineCurrent], {
    env: { ...process.env, AI_DELIVERY_POLICY_ROOT: fixture.policyRoot },
    stdio: 'ignore',
  });
  const deadline = Date.now() + 2_000;
  let reachedHealth = false;
  while (Date.now() < deadline) {
    reachedHealth = await access(marker).then(() => true, () => false);
    if (reachedHealth) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  if (!reachedHealth) child.kill('SIGKILL');
  assert.equal(reachedHealth, true, 'activation did not reach candidate health');
  assert.equal(child.exitCode, null, 'activation exited before interruption');
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGKILL');
  await exited;

  const status = await invoke(fixture, 'status', candidate);
  assert.match(status.result.current, new RegExp(candidate.treeDigest.slice(7)));
  assert.equal(status.result.previous, baselineCurrent);
  assert.equal('locks' in status.result, false);
  fixture.policy.nodes.local.deployments.app.healthChecks = [{ argv: [process.execPath, '-e', 'process.exit(0)'] }];
  await writePolicy(fixture);
  const retried = await invoke(fixture, 'activate', candidate);
  assert.equal(retried.result.mode, 'verify-only');
  assert.equal(retried.result.previous, baselineCurrent);
  const rolledBack = await invoke(fixture, 'rollback', candidate);
  assert.equal(rolledBack.result.current, baselineCurrent);
  assert.equal(rolledBack.result.readiness.status, 'ready');
});

test('a terminated activation stops the health command and restores previous', { skip: process.platform === 'win32' }, async () => {
  const fixture = await createFixture();
  const baseline = await createArtifact(fixture, 'healthy', 'a'.repeat(40));
  await invoke(fixture, 'stage', baseline);
  await invoke(fixture, 'activate', baseline);
  const baselineCurrent = await readlink(join(fixture.pointerRoot, 'current'));

  const startedPath = join(fixture.root, 'terminated-health-started');
  const stoppedPath = join(fixture.root, 'terminated-health-stopped');
  const healthScript = `const fs=require('node:fs');if(fs.readFileSync(process.argv[1],'utf8').trim()==='candidate'){process.on('SIGTERM',()=>{fs.writeFileSync(process.argv[3],'yes');process.exit(0)});fs.writeFileSync(process.argv[2],'yes');setInterval(()=>{},1000)}`;
  fixture.policy.nodes.local.deployments.app.healthChecks = [{
    argv: [process.execPath, '-e', healthScript, '{{currentDir}}/app.txt', startedPath, stoppedPath],
  }];
  fixture.policy.readiness.timeoutMs = 5_000;
  await writePolicy(fixture);
  const candidate = await createArtifact(fixture, 'candidate', 'b'.repeat(40));
  await invoke(fixture, 'stage', candidate);
  const child = spawn(process.execPath, [agent, 'activate', '--project', 'fixture', '--node', 'local', '--target', 'app', '--approval', `fixture:${candidate.sourceSha}`, '--expected-current', baselineCurrent], {
    env: { ...process.env, AI_DELIVERY_POLICY_ROOT: fixture.policyRoot },
    stdio: 'ignore',
  });
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline && !(await access(startedPath).then(() => true, () => false))) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(await access(startedPath).then(() => true, () => false), true, 'activation did not reach candidate health');
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  const exitCode = await exited;
  assert.equal(exitCode, 1);
  assert.equal(await readFile(stoppedPath, 'utf8'), 'yes');
  assert.equal(await readlink(join(fixture.pointerRoot, 'current')), baselineCurrent);
  const status = await invoke(fixture, 'status', candidate);
  assert.equal(status.result.current, baselineCurrent);
  assert.match(status.result.previous, new RegExp(baseline.sourceSha));
});

test('OSS direct mode checks health and automatically restores the immutable previous release', async () => {
  const fixture = await createFixture();
  fixture.policy.nodes.local.deployments.app.healthChecks = [
    {
      argv: [process.execPath, '-e', "const fs=require('node:fs');process.exit(fs.readFileSync(process.argv[1],'utf8').trim()==='unhealthy'?8:0)", '{{currentDir}}/app.txt'],
    },
  ];
  await writePolicy(fixture);

  const baseline = await createArtifact(fixture, 'healthy', 'c'.repeat(40));
  const activated = await invokeOss(fixture, baseline, await artifactPayload(baseline));
  assert.equal(activated.result.activation.mode, 'direct-activated');
  assert.equal(activated.result.activation.direct, true);
  assert.equal(activated.result.activation.readiness.status, 'ready');
  assert.equal(activated.result.activation.receipt.finalStatus, 'success');
  const baselineCurrent = await readlink(join(fixture.pointerRoot, 'current'));

  const candidate = await createArtifact(fixture, 'unhealthy', 'd'.repeat(40));
  const candidatePayload = await artifactPayload(candidate);
  const failed = await captureAgentFailure(() => invokeOss(fixture, candidate, candidatePayload));
  assert.equal(failed.code, 'CUTOVER_FAILED_AND_ROLLED_BACK');
  assert.equal(failed.details.rollback.finalCurrent, baselineCurrent);
  assert.equal(failed.details.rollback.readiness.status, 'ready');
  assert.equal(await readlink(join(fixture.pointerRoot, 'current')), baselineCurrent);
});

test('OSS direct mode downloads once, activates, and repeats from the remote immutable cache', async () => {
  const fixture = await createFixture();
  const artifact = await createArtifact(fixture, 'oss-prepared', '7'.repeat(40));
  const payload = await artifactPayload(artifact);
  const first = await invokeOss(fixture, artifact, payload);
  assert.equal(first.result.schema, 'ai.delivery.oss-direct.v1');
  assert.equal(first.result.cacheStatus, 'miss');
  assert.ok(first.result.downloadedBytes > 0);
  assert.equal(first.result.activation.mode, 'direct-activated');
  assert.equal(first.result.activation.receipt.finalStatus, 'success');
  assert.equal(first.result.activation.receipt.sourceSha, artifact.sourceSha);
  assert.equal(first.result.activation.receipt.controlPlane.sourceSha, 'f'.repeat(40));
  assert.deepEqual(first.result.activation.receipt.controlPlane.github, { runId: '123456', runAttempt: '2' });
  assert.equal(first.result.activation.receipt.controlPlane.remoteAgentSha256, `sha256:${await hashFile(agent)}`);
  assert.equal(first.result.activation.receipt.controlPlane.remotePolicySha256, `sha256:${await hashFile(join(fixture.policyRoot, 'fixture.json'))}`);
  assert.equal(JSON.stringify(first).includes('data:application'), false);

  const repeated = await invokeOss(fixture, artifact, {
    artifactUrl: 'http://127.0.0.1:1/not-used',
    manifestUrl: 'http://127.0.0.1:1/not-used',
  });
  assert.match(repeated.result.cacheStatus, /^hit_(?:candidate|current)$/);
  assert.equal(repeated.result.downloadedBytes, 0);
  assert.equal(repeated.result.activation.mode, 'direct-verify-only');
  assert.equal(repeated.result.activation.receipt.finalStatus, 'success');
});

test('OSS download failure leaves the current production pointer unchanged', async () => {
  const fixture = await createFixture();
  const baseline = await createArtifact(fixture, 'baseline', '6'.repeat(40));
  await invokeOss(fixture, baseline, await artifactPayload(baseline));
  const current = await readlink(join(fixture.pointerRoot, 'current'));
  const candidate = await createArtifact(fixture, 'never-downloaded', '5'.repeat(40));
  const failed = await captureAgentFailure(() =>
    invokeOss(fixture, candidate, {
      artifactUrl: 'http://127.0.0.1:1/unavailable',
      manifestUrl: 'http://127.0.0.1:1/unavailable',
    })
  );
  assert.equal(failed.code, 'OSS_DOWNLOAD_FAILED');
  assert.equal(await readlink(join(fixture.pointerRoot, 'current')), current);
});

test('OSS direct mode rejects missing deployment control-plane provenance before download', async () => {
  const fixture = await createFixture();
  const artifact = await createArtifact(fixture, 'not-deployed', '4'.repeat(40));
  const payload = await artifactPayload(artifact);
  const failed = await captureAgentFailure(() => invokeOss(fixture, artifact, payload, false));
  assert.equal(failed.code, 'CONTROL_PLANE_SHA_REQUIRED');
  await assert.rejects(
    () => readlink(join(fixture.pointerRoot, 'current')),
    (error) => error.code === 'ENOENT'
  );
  await assert.rejects(
    () => lstat(fixture.pointerRoot),
    (error) => error.code === 'ENOENT'
  );
});

test('direct v2 action does not require exact remote Agent or policy hashes', async () => {
  const fixture = await createFixture();
  const artifact = await createArtifact(fixture, 'version-independent', '1'.repeat(40));
  const payload = await artifactPayload(artifact);
  const deployed = await invokeOss(fixture, artifact, payload, true, 'deploy-oss-direct-v2');
  assert.equal(deployed.result.activation.receipt.controlPlane.remoteAgentSha256, `sha256:${await hashFile(agent)}`);
  assert.equal(deployed.result.activation.receipt.controlPlane.remotePolicySha256, `sha256:${await hashFile(join(fixture.policyRoot, 'fixture.json'))}`);
  assert.match(await readlink(join(fixture.pointerRoot, 'current')), new RegExp(artifact.sourceSha));
});

test('direct v2 deploy verifies and activates without lock or seal state', async () => {
  const fixture = await createFixture();
  const artifact = await createArtifact(fixture, 'atomic-prepared', '2'.repeat(40));
  const deployed = await invokeOss(fixture, artifact, await artifactPayload(artifact), true, 'deploy-oss-direct-v2');
  assert.equal(deployed.result.schema, 'ai.delivery.oss-direct.v1');
  assert.equal(deployed.result.activation.mode, 'direct-activated');
  assert.equal(deployed.result.activation.receipt.finalStatus, 'success');
  assert.equal(deployed.result.activation.receipt.sourceSha, artifact.sourceSha);
  await assert.rejects(
    () => lstat(join(fixture.pointerRoot, 'candidate-seal.json')),
    (error) => error.code === 'ENOENT'
  );
});

test('prepared candidate validation downloads and checks the release without moving current', async () => {
  const fixture = await createFixture();
  const baseline = await createArtifact(fixture, 'baseline', '3'.repeat(40));
  await invokeOss(fixture, baseline, await artifactPayload(baseline));
  const current = await readlink(join(fixture.pointerRoot, 'current'));
  const candidate = await createArtifact(fixture, 'candidate-only', '2'.repeat(40));
  const validated = await invokeOss(fixture, candidate, await artifactPayload(candidate), true, 'validate-oss-candidate-v3');
  assert.equal(validated.result.schema, 'ai.delivery.oss-candidate.v1');
  assert.equal(validated.result.current.unchanged, true);
  assert.equal(await readlink(join(fixture.pointerRoot, 'current')), current);
  assert.match(await readlink(join(fixture.pointerRoot, 'candidate')), new RegExp(candidate.sourceSha));
  assert.equal(validated.result.controlPlane.sourceSha, 'f'.repeat(40));
  assert.equal(validated.result.current.sourceSha, baseline.sourceSha);
});

test('prepared validation accepts only the legacy readable-mode widening of a frontend current release', async () => {
  const fixture = await createFixture();
  const baseline = await createArtifact(fixture, 'legacy-readable-baseline', '4'.repeat(40));
  await invokeOss(fixture, baseline, await artifactPayload(baseline));
  const current = await readlink(join(fixture.pointerRoot, 'current'));
  const manifestPath = join(current, 'AI_DELIVERY_ARTIFACT.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.entries = manifest.entries.map((entry) => (entry.type === 'file' ? { ...entry, mode: 0o600 } : entry));
  manifest.treeDigest = digest(manifest.entries);
  delete manifest.manifestDigest;
  manifest.manifestDigest = digest(manifest);
  await chmod(manifestPath, 0o644);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await chmod(manifestPath, 0o444);

  const candidate = await createArtifact(fixture, 'candidate', '5'.repeat(40));
  const validated = await invokeOss(fixture, candidate, await artifactPayload(candidate), true, 'validate-oss-candidate-v3');
  assert.equal(validated.result.current.sourceSha, baseline.sourceSha);

  await chmod(join(current, 'app.txt'), 0o666);
  const nextCandidate = await createArtifact(fixture, 'next-candidate', '6'.repeat(40));
  const nextPayload = await artifactPayload(nextCandidate);
  const rejected = await captureAgentFailure(() => invokeOss(fixture, nextCandidate, nextPayload, true, 'validate-oss-candidate-v3'));
  assert.equal(rejected.code, 'CURRENT_RELEASE_TREE_MISMATCH');
});

test('remote execution has no lock authority or unlock state', async () => {
  const source = await readFile(agent, 'utf8');
  assert.doesNotMatch(source, /withLocks|acquireDirectoryLock|DELIVERY_LOCKED|lockRoot|staleLockSeconds|owner\.json/);
});

test('repairs DynamicUser traversal modes for stage, activation and rollback without widening artifact files', async () => {
  const fixture = await createFixture();
  await mkdir(fixture.pointerRoot, { recursive: true });
  await chmod(dirname(fixture.pointerRoot), 0o700);
  await chmod(fixture.pointerRoot, 0o700);

  const first = await createArtifact(fixture, 'traversable-first', '9'.repeat(40));
  const staged = await invoke(fixture, 'stage', first);
  await assertTraversable(fixture);
  assert.equal((await lstat(join(staged.result.release, 'app.txt'))).mode & 0o022, 0);
  assert.equal((await lstat(join(staged.result.release, 'AI_DELIVERY_ARTIFACT.json'))).mode & 0o777, 0o444);

  await chmod(dirname(fixture.pointerRoot), 0o700);
  await chmod(fixture.pointerRoot, 0o700);
  await invoke(fixture, 'activate', first);
  await assertTraversable(fixture);

  const second = await createArtifact(fixture, 'traversable-second', '8'.repeat(40));
  await invoke(fixture, 'stage', second);
  await invoke(fixture, 'activate', second);
  await chmod(dirname(fixture.pointerRoot), 0o700);
  await chmod(fixture.pointerRoot, 0o700);
  await invoke(fixture, 'rollback', second);
  await assertTraversable(fixture);
});

test('looks up and reuses an immutable artifact without uploading it again', async () => {
  const fixture = await createFixture();
  const artifact = await createArtifact(fixture, 'deduplicated', '0'.repeat(40));
  const miss = await invoke(fixture, 'lookup', artifact);
  assert.equal(miss.result.status, 'miss');
  assert.equal(miss.result.exists, false);

  await invoke(fixture, 'stage', artifact);
  const hit = await invoke(fixture, 'lookup', artifact);
  assert.equal(hit.result.status, 'hit_candidate');
  assert.equal(hit.result.uploadedBytes, 0);
  assert.equal(hit.result.reusedBytes, artifact.archive.bytes);

  const reused = await invoke(fixture, 'reuse', artifact);
  assert.equal(reused.result.cacheStatus, 'hit_candidate');
  assert.equal(reused.result.uploadedBytes, 0);
});

test('stops safely when current changes after artifact lookup', async () => {
  const fixture = await createFixture();
  const artifact = await createArtifact(fixture, 'compare-and-swap', 'a'.repeat(40));
  await invoke(fixture, 'stage', artifact);
  await assert.rejects(
    () => invoke(fixture, 'activate', artifact, null, 'local', '/unexpected/current'),
    (error) => {
      assert.match(error.stderr, /CURRENT_POINTER_CHANGED/);
      return true;
    }
  );
  await assert.rejects(() => readlink(join(fixture.pointerRoot, 'current')), { code: 'ENOENT' });
});

test('a superseded lock-free cutover never rolls current back over the newer release', async () => {
  const fixture = await createFixture();
  const first = await createArtifact(fixture, 'slow-first', '1'.repeat(40));
  const second = await createArtifact(fixture, 'fast-second', '2'.repeat(40));
  fixture.policy.readiness = { timeoutMs: 2_000, intervalMs: 20, attemptTimeoutMs: 1_500, hardFailureGraceMs: 50 };
  fixture.policy.nodes.local.deployments.app.healthChecks = [
    {
      argv: [process.execPath, '-e', `setTimeout(()=>process.exit(0),process.argv[1].includes('${first.sourceSha}')?800:0)`, '{{currentDir}}'],
    },
  ];
  await writePolicy(fixture);
  await invoke(fixture, 'stage', first);
  const firstActivation = invoke(fixture, 'activate', first);
  await waitForCurrent(fixture.pointerRoot, first.sourceSha);
  await invoke(fixture, 'stage', second);
  const secondActivation = await invoke(fixture, 'activate', second);
  assert.equal(secondActivation.result.current.includes(second.sourceSha), true);
  const superseded = await captureAgentFailure(() => firstActivation);
  assert.equal(superseded.code, 'CUTOVER_SUPERSEDED');
  assert.equal(superseded.details.recovery, 'not-performed-because-a-newer-cutover-owns-current');
  assert.match(await readlink(join(fixture.pointerRoot, 'current')), new RegExp(second.sourceSha));
});

test('an exact current artifact switches to verify-only without restart or pointer movement', async () => {
  const fixture = await createFixture();
  const artifact = await createArtifact(fixture, 'already-current', 'b'.repeat(40));
  await invoke(fixture, 'stage', artifact);
  await invoke(fixture, 'activate', artifact);
  const before = await readlink(join(fixture.pointerRoot, 'current'));
  const verified = await invoke(fixture, 'activate', artifact);
  assert.equal(verified.result.mode, 'verify-only');
  assert.equal(verified.result.alreadyCurrent, true);
  assert.equal(verified.result.readiness.status, 'ready');
  assert.deepEqual(verified.result.restart, { kind: 'none', target: 'none', commandCount: 0, commands: [] });
  assert.equal(await readlink(join(fixture.pointerRoot, 'current')), before);
});

test('waits for a service that becomes ready after two seconds', async () => {
  const fixture = await createFixture();
  const readyAt = join(fixture.root, 'ready-at');
  fixture.policy.readiness = { timeoutMs: 3_000, intervalMs: 100, attemptTimeoutMs: 200, hardFailureGraceMs: 500 };
  fixture.policy.nodes.local.deployments.app.healthChecks = [
    {
      argv: [process.execPath, '-e', "const fs=require('node:fs');process.exit(Date.now()>=Number(fs.readFileSync(process.argv[1],'utf8'))?0:75)", readyAt],
    },
  ];
  await writeFile(readyAt, String(Date.now() + 2_000));
  await writePolicy(fixture);
  const artifact = await createArtifact(fixture, 'delayed-ready', 'a'.repeat(40));
  await invoke(fixture, 'stage', artifact);
  const activated = await invoke(fixture, 'activate', artifact);
  assert.equal(activated.result.readiness.status, 'ready');
  assert.ok(activated.result.readiness.durationMs >= 1_700, activated.result.readiness);
  assert.ok(activated.result.readiness.durationMs < 3_000, activated.result.readiness);
  assert.ok(activated.result.readiness.attempts > 1);
});

test('retries transient HTTP 503 failures until the fourth attempt succeeds', async () => {
  const fixture = await createFixture();
  const counter = join(fixture.root, 'health-attempts');
  await writeFile(counter, '0');
  fixture.policy.nodes.local.deployments.app.healthChecks = [
    {
      argv: [process.execPath, '-e', "const fs=require('node:fs');const p=process.argv[1];const n=Number(fs.readFileSync(p,'utf8'))+1;fs.writeFileSync(p,String(n));if(n<4){process.stderr.write('HTTP 503');process.exit(22)}", counter],
    },
  ];
  await writePolicy(fixture);
  const artifact = await createArtifact(fixture, 'transient-503', 'b'.repeat(40));
  await invoke(fixture, 'stage', artifact);
  const activated = await invoke(fixture, 'activate', artifact);
  assert.equal(activated.result.readiness.status, 'ready');
  assert.equal(activated.result.readiness.attempts, 4);
  assert.match(activated.result.readiness.lastError.details.outputTail, /HTTP 503/);
});

test('systemd dependency-isolated mode is used for activation and rollback', async () => {
  const fixture = await createFixture();
  const bin = join(fixture.root, 'bin');
  const pidFile = join(fixture.root, 'systemd.pid');
  const logFile = join(fixture.root, 'systemd.log');
  await mkdir(bin);
  await writeFile(pidFile, '100\n');
  const systemctl = join(bin, 'systemctl');
  await writeFile(
    systemctl,
    `#!/bin/sh
if [ "$1" = "show" ]; then
  value=$(cat "$AI_TEST_PID_FILE")
  case " $* " in
    *" --value "*) printf '%s\\n' "$value" ;;
    *) printf 'ActiveState=active\\nSubState=running\\nResult=success\\nMainPID=%s\\n' "$value" ;;
  esac
  exit 0
fi
printf '%s\\n' "$*" >> "$AI_TEST_LOG_FILE"
value=$(cat "$AI_TEST_PID_FILE")
expr "$value" + 1 > "$AI_TEST_PID_FILE"
`
  );
  await chmod(systemctl, 0o755);
  fixture.environment = { PATH: `${bin}:${process.env.PATH}`, AI_TEST_PID_FILE: pidFile, AI_TEST_LOG_FILE: logFile };
  fixture.policy.nodes.local.deployments.app.restart = { kind: 'systemd', name: 'fixture.service', jobMode: 'ignore-dependencies' };
  await writePolicy(fixture);

  const first = await createArtifact(fixture, 'systemd-first', 'c'.repeat(40));
  await invoke(fixture, 'stage', first);
  const firstActivated = await invoke(fixture, 'activate', first);
  assert.equal(firstActivated.result.restart.commandCount, 1);
  assert.equal(firstActivated.result.restart.target, 'fixture.service');
  const second = await createArtifact(fixture, 'systemd-second', 'd'.repeat(40));
  await invoke(fixture, 'stage', second);
  const secondActivated = await invoke(fixture, 'activate', second);
  assert.equal(secondActivated.result.restart.commandCount, 1);
  assert.deepEqual(secondActivated.result.restart.commands, [['systemctl', '--job-mode=ignore-dependencies', 'restart', 'fixture.service']]);
  const rolledBack = await invoke(fixture, 'rollback', second);
  assert.equal(rolledBack.result.restart.commandCount, 1);
  assert.equal(rolledBack.result.restart.target, 'fixture.service');
  const commands = await readFile(logFile, 'utf8');
  assert.equal(commands.match(/--job-mode=ignore-dependencies restart fixture\.service/g)?.length, 3);
});

test('a systemd hard failure starts pointer recovery within three seconds', async () => {
  const fixture = await createFixture();
  const bin = join(fixture.root, 'hard-failure-bin');
  const restartFile = join(fixture.root, 'hard-failure-restarts');
  const commandLog = join(fixture.root, 'hard-failure-systemd.log');
  await mkdir(bin);
  await writeFile(restartFile, '0\n');
  await writeFile(commandLog, '');
  const systemctl = join(bin, 'systemctl');
  await writeFile(
    systemctl,
    `#!/bin/sh
value=$(cat "$AI_TEST_RESTART_FILE")
if [ "$1" = "show" ]; then
  case " $* " in
    *" --value "*)
      if [ "$value" -eq 2 ]; then printf '0\n'; else expr "$value" + 100; fi
      ;;
    *)
      if [ "$value" -eq 2 ]; then
        printf 'ActiveState=failed\nSubState=failed\nResult=exit-code\nMainPID=0\n'
      else
        printf 'ActiveState=active\nSubState=running\nResult=success\nMainPID=%s\n' "$(expr "$value" + 100)"
      fi
      ;;
  esac
  exit 0
fi
printf '%s\n' "$*" >> "$AI_TEST_COMMAND_LOG"
expr "$value" + 1 > "$AI_TEST_RESTART_FILE"
`
  );
  await chmod(systemctl, 0o755);
  fixture.environment = { PATH: `${bin}:${process.env.PATH}`, AI_TEST_RESTART_FILE: restartFile, AI_TEST_COMMAND_LOG: commandLog };
  fixture.policy.nodes.local.deployments.app.restart = { kind: 'systemd', name: 'fixture.service', jobMode: 'ignore-dependencies' };
  await writePolicy(fixture);

  const first = await createArtifact(fixture, 'hard-failure-baseline', 'c'.repeat(40));
  await invoke(fixture, 'stage', first);
  await invoke(fixture, 'activate', first);
  const baseline = await readlink(join(fixture.pointerRoot, 'current'));
  const second = await createArtifact(fixture, 'hard-failure-candidate', 'd'.repeat(40));
  await invoke(fixture, 'stage', second);
  fixture.policy.nodes.local.deployments.app.healthChecks = [{ argv: [process.execPath, '-e', `process.exit(process.argv[1].includes('${second.sourceSha}')?7:0)`, '{{currentDir}}'] }];
  await writePolicy(fixture);
  const failed = await captureAgentFailure(() => invoke(fixture, 'activate', second));
  assert.equal(failed.code, 'CUTOVER_FAILED_AND_ROLLED_BACK');
  assert.equal(failed.details.candidateFailure.code, 'READINESS_HARD_FAILURE');
  assert.match(failed.details.candidateFailure.details.failureConfirmedAt, /Z$/);
  assert.match(failed.details.failureConfirmedAt, /Z$/);
  assert.match(failed.details.rollback.startedAt, /Z$/);
  assert.ok(failed.details.rollback.triggerDelayMs <= 3_000, failed.details.rollback);
  assert.equal(failed.details.rollback.triggeredWithinMs, true);
  assert.equal(failed.details.rollback.finalCurrent, baseline);
  assert.equal(failed.details.restartCommands.total, 2);
  assert.equal(failed.details.restartCommands.candidate.target, 'fixture.service');
  assert.equal(failed.details.restartCommands.rollback.target, 'fixture.service');
  const commands = await readFile(commandLog, 'utf8');
  const resetIndex = commands.indexOf('reset-failed fixture.service');
  assert.ok(resetIndex >= 0, commands);
  assert.ok(commands.lastIndexOf('--job-mode=ignore-dependencies restart fixture.service') < resetIndex, commands);
  assert.deepEqual(failed.details.protectedProcesses.after, failed.details.protectedProcesses.before);
});

test('readiness timeout restores both current and runtime before reporting rollback success', async () => {
  const fixture = await createFixture();
  await writeFile(join(fixture.root, 'package-lock.json'), '{"lockfileVersion":3,"version":"old"}\n');
  const layerConfig = {
    strategy: 'shared-content-addressed',
    runtime: 'node22-linux-x64-test',
    keyFiles: ['package-lock.json'],
    productionRoot: join(fixture.root, 'layers'),
  };
  const first = await createArtifact(fixture, 'healthy', 'e'.repeat(40), layerConfig);
  const oldLayer = await materializeLayer(fixture, first, layerConfig);
  await invoke(fixture, 'stage', first);
  await invoke(fixture, 'activate', first);
  const before = await readlink(join(fixture.pointerRoot, 'current'));

  await writeFile(join(fixture.root, 'package-lock.json'), '{"lockfileVersion":3,"version":"new"}\n');
  const second = await createArtifact(fixture, 'unhealthy', 'f'.repeat(40), layerConfig);
  await materializeLayer(fixture, second, layerConfig);
  await invoke(fixture, 'stage', second);
  fixture.policy.nodes.local.deployments.app.healthChecks = [{ argv: [process.execPath, '-e', `process.exit(process.argv[1].includes('${second.sourceSha}')?7:0)`, '{{currentDir}}'] }];
  await writePolicy(fixture);
  const failed = await captureAgentFailure(() => invoke(fixture, 'activate', second));
  assert.equal(failed.code, 'CUTOVER_FAILED_AND_ROLLED_BACK');
  assert.equal(failed.details.candidateFailure.code, 'READINESS_TIMEOUT');
  assert.equal(failed.details.rollback.readiness.status, 'ready');
  assert.equal(failed.details.rollback.triggeredWithinMs, true);
  assert.equal(await readlink(join(fixture.pointerRoot, 'current')), before);
  assert.equal(await readlink(join(fixture.pointerRoot, 'runtime')), oldLayer);
});

test('a timed-out health command leaves no running descendant after rollback', { skip: process.platform === 'win32' }, async () => {
  const fixture = await createFixture();
  const baseline = await createArtifact(fixture, 'healthy', '1'.repeat(40));
  await invoke(fixture, 'stage', baseline);
  await invoke(fixture, 'activate', baseline);
  const baselineCurrent = await readlink(join(fixture.pointerRoot, 'current'));
  const candidate = await createArtifact(fixture, 'candidate', '2'.repeat(40));
  await invoke(fixture, 'stage', candidate);
  const pidPath = join(fixture.root, 'timed-out-health.pid');
  const heartbeatPath = join(fixture.root, 'timed-out-health.heartbeat');
  const descendant = `const fs=require('node:fs');setInterval(()=>fs.writeFileSync(${JSON.stringify(heartbeatPath)},String(Date.now())),20)`;
  const check = `const fs=require('node:fs');const {spawn}=require('node:child_process');if(!process.argv[1].includes(${JSON.stringify(candidate.sourceSha)}))process.exit(0);if(fs.existsSync(${JSON.stringify(pidPath)}))process.exit(7);const child=spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(pidPath)},String(child.pid));setInterval(()=>{},1000)`;
  fixture.policy.readiness = { timeoutMs: 700, intervalMs: 20, attemptTimeoutMs: 250, hardFailureGraceMs: 50 };
  fixture.policy.nodes.local.deployments.app.healthChecks = [{ argv: [process.execPath, '-e', check, '{{currentDir}}'] }];
  await writePolicy(fixture);
  try {
    const failed = await captureAgentFailure(() => invoke(fixture, 'activate', candidate));
    assert.equal(failed.code, 'CUTOVER_FAILED_AND_ROLLED_BACK');
    assert.equal(failed.details.rollback.finalCurrent, baselineCurrent);
    assert.equal(failed.details.rollback.readiness.status, 'ready');
    const heartbeat = await readFile(heartbeatPath, 'utf8');
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(await readFile(heartbeatPath, 'utf8'), heartbeat, 'timed-out health descendant stopped before recovery completed');
  } finally {
    const pid = await readFile(pidPath, 'utf8').catch(() => null);
    if (pid) {
      try { process.kill(Number(pid), 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
  }
});

test('an unrelated service PID change does not roll back a healthy target', async () => {
  const fixture = await createFixture();
  const bin = join(fixture.root, 'protected-change-bin');
  const targetPid = join(fixture.root, 'target.pid');
  const protectedPid = join(fixture.root, 'protected.pid');
  const mutateProtected = join(fixture.root, 'mutate-protected');
  await mkdir(bin);
  await writeFile(targetPid, '100\n');
  await writeFile(protectedPid, '900\n');
  await writeFile(mutateProtected, '0\n');
  const systemctl = join(bin, 'systemctl');
  await writeFile(
    systemctl,
    `#!/bin/sh
last=''
for argument in "$@"; do last="$argument"; done
if [ "$1" = "show" ]; then
  if [ "$last" = "sentinel.service" ]; then value=$(cat "$AI_TEST_PROTECTED_PID"); else value=$(cat "$AI_TEST_TARGET_PID"); fi
  case " $* " in
    *" --value "*) printf '%s\\n' "$value" ;;
    *) printf 'ActiveState=active\\nSubState=running\\nResult=success\\nMainPID=%s\\n' "$value" ;;
  esac
  exit 0
fi
case " $* " in
  *" restart fixture.service ")
    value=$(cat "$AI_TEST_TARGET_PID")
    expr "$value" + 1 > "$AI_TEST_TARGET_PID"
    if [ "$(cat "$AI_TEST_MUTATE_PROTECTED")" = "1" ]; then
      value=$(cat "$AI_TEST_PROTECTED_PID")
      expr "$value" + 1 > "$AI_TEST_PROTECTED_PID"
    fi
    ;;
esac
`
  );
  await chmod(systemctl, 0o755);
  fixture.environment = {
    PATH: `${bin}:${process.env.PATH}`,
    AI_TEST_TARGET_PID: targetPid,
    AI_TEST_PROTECTED_PID: protectedPid,
    AI_TEST_MUTATE_PROTECTED: mutateProtected,
  };
  fixture.policy.protectedProcesses = [{ kind: 'systemd', name: 'sentinel.service' }];
  fixture.policy.nodes.local.deployments.app.restart = { kind: 'systemd', name: 'fixture.service', jobMode: 'ignore-dependencies' };
  await writePolicy(fixture);

  const baseline = await createArtifact(fixture, 'protected-baseline', '7'.repeat(40));
  await invoke(fixture, 'stage', baseline);
  await invoke(fixture, 'activate', baseline);
  const candidate = await createArtifact(fixture, 'protected-candidate', '8'.repeat(40));
  await invoke(fixture, 'stage', candidate);
  await writeFile(mutateProtected, '1\n');
  const activated = await invoke(fixture, 'activate', candidate);
  assert.equal(activated.result.readiness.status, 'ready');
  assert.equal(activated.result.receipt.nonTargetProcesses.unchanged, false);
  assert.match(await readlink(join(fixture.pointerRoot, 'current')), new RegExp(candidate.treeDigest.slice(7)));
});

test('rollback waits for the previous service to become ready', async () => {
  const fixture = await createFixture();
  const first = await createArtifact(fixture, 'rollback-ready-baseline', '1'.repeat(40));
  await invoke(fixture, 'stage', first);
  await invoke(fixture, 'activate', first);
  const second = await createArtifact(fixture, 'rollback-ready-candidate', '2'.repeat(40));
  await invoke(fixture, 'stage', second);
  const stateFile = join(fixture.root, 'rollback-health-state');
  const healthScript = `const fs=require('node:fs');const current=process.argv[1];const state=process.argv[2];if(current.includes('${second.sourceSha}')){fs.writeFileSync(state,'0');process.exit(7)}const n=Number(fs.readFileSync(state,'utf8'))+1;fs.writeFileSync(state,String(n));process.exit(n>=3?0:75)`;
  fixture.policy.nodes.local.deployments.app.healthChecks = [{ argv: [process.execPath, '-e', healthScript, '{{currentDir}}', stateFile] }];
  fixture.policy.readiness.timeoutMs = 1_000;
  await writePolicy(fixture);
  const failed = await captureAgentFailure(() => invoke(fixture, 'activate', second));
  assert.equal(failed.code, 'CUTOVER_FAILED_AND_ROLLED_BACK');
  assert.equal(failed.details.rollback.readiness.status, 'ready');
  assert.ok(failed.details.rollback.readiness.attempts >= 3);
  assert.ok(failed.details.rollback.readinessMs > 0);
});

test('manual rollback failure reports the actual pointers and service without switching back', async () => {
  const fixture = await createFixture();
  const first = await createArtifact(fixture, 'previous-unhealthy', '5'.repeat(40));
  await invoke(fixture, 'stage', first);
  await invoke(fixture, 'activate', first);
  const second = await createArtifact(fixture, 'current-healthy', '6'.repeat(40));
  await invoke(fixture, 'stage', second);
  await invoke(fixture, 'activate', second);
  const originalCurrent = await readlink(join(fixture.pointerRoot, 'current'));
  const attemptedCurrent = await readlink(join(fixture.pointerRoot, 'previous'));
  fixture.policy.nodes.local.deployments.app.healthChecks = [{
    argv: [process.execPath, '-e', `process.exit(process.argv[1].includes('${first.sourceSha}') ? 7 : 0)`, '{{currentDir}}'],
  }];
  fixture.policy.readiness.timeoutMs = 150;
  await writePolicy(fixture);

  const failed = await captureAgentFailure(() => invoke(fixture, 'rollback', second));
  assert.equal(failed.code, 'ROLLBACK_FAILED');
  assert.equal(failed.details.rollbackFailure.code, 'READINESS_TIMEOUT');
  assert.equal(failed.details.originalCurrent, originalCurrent);
  assert.equal(failed.details.attemptedCurrent, attemptedCurrent);
  assert.equal(failed.details.current, attemptedCurrent);
  assert.equal(failed.details.previous, originalCurrent);
  assert.equal(failed.details.serviceStatus.activeState, 'unmonitored');
  assert.match(failed.details.nextAction, /Do not repeat rollback blindly/);
  assert.equal(await readlink(join(fixture.pointerRoot, 'current')), attemptedCurrent);
  const status = await invoke(fixture, 'status', second);
  assert.equal(status.result.current, attemptedCurrent);
  assert.equal(status.result.previous, originalCurrent);
});

test('preserves candidate and rollback failure evidence when the previous service stays unhealthy', async () => {
  const fixture = await createFixture();
  const first = await createArtifact(fixture, 'rollback-failure-baseline', '3'.repeat(40));
  await invoke(fixture, 'stage', first);
  await invoke(fixture, 'activate', first);
  const second = await createArtifact(fixture, 'rollback-failure-candidate', '4'.repeat(40));
  await invoke(fixture, 'stage', second);
  fixture.policy.nodes.local.deployments.app.healthChecks = [{ argv: [process.execPath, '-e', 'process.exit(7)'] }];
  await writePolicy(fixture);
  const failed = await captureAgentFailure(() => invoke(fixture, 'activate', second));
  assert.equal(failed.code, 'CUTOVER_FAILED_ROLLBACK_UNHEALTHY');
  assert.equal(failed.details.candidateFailure.code, 'READINESS_TIMEOUT');
  assert.equal(failed.details.rollbackFailure.code, 'READINESS_TIMEOUT');
  assert.match(failed.details.rollback.finalCurrent, new RegExp(first.sourceSha));
});

test('rejects a tampered archive before creating a candidate', async () => {
  const fixture = await createFixture();
  const artifact = await createArtifact(fixture, 'original', 'e'.repeat(40));
  await writeFile(artifact.archive.path, 'tampered');
  await assert.rejects(
    () => invoke(fixture, 'stage', artifact),
    (error) => {
      assert.match(error.stderr, /ARTIFACT_ARCHIVE_HASH_MISMATCH/);
      return true;
    }
  );
});

test('rejects a manifest that names a forbidden dependency directory', async () => {
  const fixture = await createFixture();
  const artifact = await createArtifact(fixture, 'forbidden-manifest', 'e'.repeat(40));
  const manifest = JSON.parse(await readFile(artifact.manifestPath, 'utf8'));
  manifest.entries.push({ path: 'node_modules/', type: 'directory', mode: 0o755 });
  manifest.fileCount = manifest.entries.length;
  manifest.treeDigest = digest(manifest.entries);
  delete manifest.manifestDigest;
  manifest.manifestDigest = digest(manifest);
  await writeFile(artifact.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  artifact.treeDigest = manifest.treeDigest;
  artifact.manifestDigest = manifest.manifestDigest;
  await assert.rejects(
    () => invoke(fixture, 'stage', artifact),
    (error) => {
      assert.match(error.stderr, /ARTIFACT_FORBIDDEN_PATH/);
      return true;
    }
  );
});

test('rejects an unsafe digest before deriving a release path', async () => {
  const fixture = await createFixture();
  const artifact = await createArtifact(fixture, 'unsafe-digest', '9'.repeat(40));
  const manifest = JSON.parse(await readFile(artifact.manifestPath, 'utf8'));
  manifest.treeDigest = 'sha256:../../outside';
  delete manifest.manifestDigest;
  manifest.manifestDigest = digest(manifest);
  await writeFile(artifact.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  artifact.treeDigest = manifest.treeDigest;
  await assert.rejects(
    () => invoke(fixture, 'stage', artifact),
    (error) => {
      assert.match(error.stderr, /ARTIFACT_TREE_DIGEST_INVALID/);
      return true;
    }
  );
});

test('candidate failure never moves the candidate or current pointer', async () => {
  const fixture = await createFixture();
  const artifact = await createArtifact(fixture, 'candidate-failure', 'f'.repeat(40));
  fixture.policy.nodes.local.deployments.app.candidateChecks = [{ argv: [process.execPath, '-e', 'process.exit(9)'] }];
  await writePolicy(fixture);
  await assert.rejects(
    () => invoke(fixture, 'stage', artifact),
    (error) => {
      assert.match(error.stderr, /REMOTE_COMMAND_FAILED/);
      return true;
    }
  );
  const audit = (await readFile(join(fixture.root, 'audit', 'fixture.jsonl'), 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.ok(audit.some((record) => record.action === 'stage' && record.error?.code === 'REMOTE_COMMAND_FAILED'));
  await assert.rejects(() => readlink(join(fixture.pointerRoot, 'candidate')), { code: 'ENOENT' });
  await assert.rejects(() => readlink(join(fixture.pointerRoot, 'current')), { code: 'ENOENT' });
});

test('activation candidate checks run once and never enter health polling', async () => {
  const fixture = await createFixture();
  const first = await createArtifact(fixture, 'candidate-check-baseline', '5'.repeat(40));
  await invoke(fixture, 'stage', first);
  await invoke(fixture, 'activate', first);
  const baseline = await readlink(join(fixture.pointerRoot, 'current'));
  const second = await createArtifact(fixture, 'candidate-check-failure', '6'.repeat(40));
  await invoke(fixture, 'stage', second);
  const candidateCounter = join(fixture.root, 'candidate-check-count');
  const healthCounter = join(fixture.root, 'health-check-count');
  await writeFile(candidateCounter, '0');
  await writeFile(healthCounter, '0');
  const increment = "const fs=require('node:fs');const p=process.argv[1];fs.writeFileSync(p,String(Number(fs.readFileSync(p,'utf8'))+1));process.exit(Number(process.argv[2]))";
  fixture.policy.nodes.local.deployments.app.candidateChecks = [{ argv: [process.execPath, '-e', increment, candidateCounter, '9'] }];
  fixture.policy.nodes.local.deployments.app.healthChecks = [{ argv: [process.execPath, '-e', increment, healthCounter, '0'] }];
  await writePolicy(fixture);
  const failed = await captureAgentFailure(() => invoke(fixture, 'activate', second));
  assert.equal(failed.code, 'REMOTE_COMMAND_FAILED');
  assert.equal(await readFile(candidateCounter, 'utf8'), '1');
  assert.equal(await readFile(healthCounter, 'utf8'), '0');
  assert.equal(await readlink(join(fixture.pointerRoot, 'current')), baseline);
});

test('production activation requires the exact source approval', async () => {
  const fixture = await createFixture();
  const artifact = await createArtifact(fixture, 'approval', '1'.repeat(40));
  await invoke(fixture, 'stage', artifact);
  await assert.rejects(
    () => invoke(fixture, 'activate', artifact, 'fixture:wrong'),
    (error) => {
      assert.match(error.stderr, /PRODUCTION_APPROVAL_INVALID/);
      return true;
    }
  );
  await assert.rejects(() => readlink(join(fixture.pointerRoot, 'current')), { code: 'ENOENT' });
});

test('database migration activation records the selected ledger delta, retries as a no-op and never restarts', async () => {
  const fixture = await createFixture();
  const ledger = join(fixture.root, 'migration-ledger.json');
  const environmentFile = join(fixture.root, 'migration.env');
  await writeFile(ledger, JSON.stringify([{ version: '20990101000000', name: '20990101000000_first.sql', statements: [] }]));
  await writeFile(environmentFile, `AI_TEST_LEDGER=${ledger}\n`);
  fixture.policy.nodes.local.deployments.app = migrationDeployment(fixture, environmentFile);
  await writePolicy(fixture);
  const artifact = await createMigrationArtifact(fixture, '7'.repeat(40));
  await invoke(fixture, 'stage', artifact);

  const activated = await invoke(fixture, 'activate', artifact);
  assert.equal(activated.result.restart.commandCount, 0);
  assert.equal(activated.result.receipt.restart.commandCount, 0);
  assert.equal(activated.result.receipt.databaseMigration.status, 'applied');
  assert.deepEqual(
    activated.result.receipt.databaseMigration.selected.map((item) => item.version),
    ['20990102000000']
  );
  assert.equal(activated.result.receipt.databaseMigration.ledgerBefore.count, 1);
  assert.equal(activated.result.receipt.databaseMigration.ledgerAfter.count, 2);
  assert.equal(activated.result.receipt.databaseRecovery.databaseRollback, 'not-performed');

  const retried = await invoke(fixture, 'activate', artifact);
  assert.equal(retried.result.receipt.databaseMigration.status, 'noop');
  assert.deepEqual(retried.result.receipt.databaseMigration.selected, []);
  assert.equal(retried.result.restart.commandCount, 0);

  const current = await readlink(join(fixture.pointerRoot, 'current'));
  const rollbackFailure = await captureAgentFailure(() => invoke(fixture, 'rollback', artifact));
  assert.equal(rollbackFailure.code, 'DATABASE_ROLLBACK_UNSUPPORTED');
  assert.equal(rollbackFailure.details.pointerAction, 'not-performed');
  assert.equal(await readlink(join(fixture.pointerRoot, 'current')), current);
});

test('database owner migration combines managed runtime and owner credential files without exposing values', async () => {
  const fixture = await createFixture();
  const ledger = join(fixture.root, 'owner-migration-ledger.json');
  const environmentFile = join(fixture.root, 'migration.env');
  const credentialFile = join(fixture.root, 'owner.env');
  await writeFile(ledger, '[]');
  await writeFile(environmentFile, `AI_TEST_LEDGER=${ledger}\nAI_TEST_EXPECT_OWNER=1\n`);
  await writeFile(credentialFile, 'AI_TEST_OWNER_CREDENTIAL=fixture-owner-secret\n');
  const deployment = migrationDeployment(fixture, environmentFile);
  deployment.databaseMigration = {
    ...deployment.databaseMigration,
    credentialFile,
    executionMode: 'database-owner',
    ownerDatabaseHost: '127.0.0.1',
    ownerDatabasePort: 55432,
  };
  fixture.policy.nodes.local.deployments.app = deployment;
  await writePolicy(fixture);
  const artifact = await createMigrationArtifact(fixture, '6'.repeat(40));
  await invoke(fixture, 'stage', artifact);

  const activated = await invoke(fixture, 'activate', artifact);
  assert.equal(activated.result.receipt.databaseMigration.status, 'applied');
  assert.deepEqual(activated.result.receipt.databaseMigration.credentialSources, [environmentFile, credentialFile]);
  assert.doesNotMatch(JSON.stringify(activated), /fixture-owner-secret/);
});

test('database migration failure keeps pointers and ledger unchanged with a failed zero-restart receipt', async () => {
  const fixture = await createFixture();
  const ledger = join(fixture.root, 'migration-ledger.json');
  const environmentFile = join(fixture.root, 'migration.env');
  await writeFile(ledger, '[]');
  await writeFile(environmentFile, `AI_TEST_LEDGER=${ledger}\nAI_TEST_FAIL=1\n`);
  fixture.policy.nodes.local.deployments.app = migrationDeployment(fixture, environmentFile);
  await writePolicy(fixture);
  const artifact = await createMigrationArtifact(fixture, '8'.repeat(40));
  await invoke(fixture, 'stage', artifact);

  const failed = await captureAgentFailure(() => invoke(fixture, 'activate', artifact));
  assert.equal(failed.code, 'DATABASE_MIGRATION_FAILED');
  assert.equal(failed.details.receipt.finalStatus, 'failed');
  assert.equal(failed.details.receipt.databaseMigration.status, 'failed');
  assert.equal(failed.details.receipt.restart.commandCount, 0);
  assert.deepEqual(JSON.parse(await readFile(ledger, 'utf8')), []);
  await assert.rejects(() => readlink(join(fixture.pointerRoot, 'current')), { code: 'ENOENT' });
});

test('post-migration pointer failure restores only pointers and reports that the database remains applied', async () => {
  const fixture = await createFixture();
  const ledger = join(fixture.root, 'migration-ledger.json');
  const environmentFile = join(fixture.root, 'migration.env');
  await writeFile(ledger, '[]');
  await writeFile(environmentFile, `AI_TEST_LEDGER=${ledger}\n`);
  fixture.policy.nodes.local.deployments.app = migrationDeployment(fixture, environmentFile);
  fixture.policy.nodes.local.deployments.app.healthChecks = [{ argv: [process.execPath, '-e', 'process.exit(9)'] }];
  await writePolicy(fixture);
  const artifact = await createMigrationArtifact(fixture, '9'.repeat(40));
  await invoke(fixture, 'stage', artifact);

  const failed = await captureAgentFailure(() => invoke(fixture, 'activate', artifact));
  assert.equal(failed.code, 'DATABASE_MIGRATION_POINTER_RECORD_FAILED');
  assert.equal(failed.details.databaseMigration.status, 'applied');
  assert.equal(failed.details.databaseRollback, 'not-performed');
  assert.equal(failed.details.pointerRecovery.status, 'restored');
  assert.equal(failed.details.receipt.finalStatus, 'database-applied-pointer-record-failed');
  assert.equal(failed.details.receipt.restart.commandCount, 0);
  assert.equal(JSON.parse(await readFile(ledger, 'utf8')).length, 2);
  await assert.rejects(() => readlink(join(fixture.pointerRoot, 'current')), { code: 'ENOENT' });
});

test('requires and binds a declared dependency layer', async () => {
  const fixture = await createFixture();
  await writeFile(join(fixture.root, 'package-lock.json'), '{"lockfileVersion":3}\n');
  const layerConfig = {
    strategy: 'shared-content-addressed',
    runtime: 'node22-linux-x64-test',
    keyFiles: ['package-lock.json'],
    productionRoot: join(fixture.root, 'layers'),
  };
  const artifact = await createArtifact(fixture, 'layered', '2'.repeat(40), layerConfig);
  await assert.rejects(
    () => invoke(fixture, 'stage', artifact),
    (error) => {
      assert.match(error.stderr, /DEPENDENCY_LAYER_MISSING/);
      return true;
    }
  );
  const layer = join(layerConfig.productionRoot, artifact.dependencyLayer.digest.slice(7));
  await mkdir(layer, { recursive: true });
  await writeFile(
    join(layer, 'AI_DELIVERY_LAYER.json'),
    `${JSON.stringify({
      schema: 'ai.delivery.dependency-layer.v1',
      digest: artifact.dependencyLayer.digest,
      runtime: layerConfig.runtime,
    })}\n`
  );
  await invoke(fixture, 'stage', artifact);
  await invoke(fixture, 'activate', artifact);
  assert.equal(await readlink(join(fixture.pointerRoot, 'runtime')), layer);
});

test('stages a missing declared dependency layer atomically', async () => {
  const fixture = await createFixture();
  await writeFile(join(fixture.root, 'package-lock.json'), '{"lockfileVersion":3}\n');
  const layerConfig = {
    strategy: 'shared-content-addressed',
    runtime: 'node22-linux-x64-test',
    keyFiles: ['package-lock.json'],
    productionRoot: join(fixture.root, 'layers'),
  };
  fixture.policy.allowedDependencyRoots = [layerConfig.productionRoot];
  fixture.policy.nodes.local.deployments.app.seedDependencyLayer = {
    source: 'node_modules',
    runtime: layerConfig.runtime,
    keyFiles: layerConfig.keyFiles,
    productionRoot: layerConfig.productionRoot,
  };
  await writePolicy(fixture);
  const artifact = await createArtifact(fixture, 'layer-upload', '9'.repeat(40), layerConfig);
  const source = join(fixture.root, 'layer-source');
  await mkdir(join(source, 'node_modules', 'runtime-package'), { recursive: true });
  await writeFile(join(source, 'node_modules', 'runtime-package', 'index.js'), 'export default true;\n');
  await writeFile(
    join(source, 'AI_DELIVERY_LAYER.json'),
    `${JSON.stringify({
      schema: 'ai.delivery.dependency-layer.v1',
      project: 'fixture',
      target: 'app',
      digest: artifact.dependencyLayer.digest,
      runtime: layerConfig.runtime,
    })}\n`
  );
  const archive = join(fixture.policy.incomingRoot, 'dependency-layer.tar.gz');
  await execFileAsync('tar', ['-czf', archive, '-C', source, '.']);
  const args = [
    agent,
    'stage-layer',
    '--project',
    'fixture',
    '--node',
    'local',
    '--target',
    'app',
    '--archive',
    archive,
    '--sha256',
    await hashFile(archive),
    '--digest',
    artifact.dependencyLayer.digest,
    '--runtime',
    layerConfig.runtime,
    '--production-root',
    layerConfig.productionRoot,
  ];
  const staged = await execFileAsync(process.execPath, args, { env: { ...process.env, AI_DELIVERY_POLICY_ROOT: fixture.policyRoot }, maxBuffer: 1024 * 1024 });
  assert.equal(JSON.parse(staged.stdout).result.reused, false);
  const layer = join(layerConfig.productionRoot, artifact.dependencyLayer.digest.slice(7));
  assert.equal(await readFile(join(layer, 'node_modules', 'runtime-package', 'index.js'), 'utf8'), 'export default true;\n');
  await invoke(fixture, 'stage', artifact);
});

test('keeps source provenance distinct when two commits produce the same tree', async () => {
  const fixture = await createFixture();
  const first = await createArtifact(fixture, 'same-output', '7'.repeat(40));
  await invoke(fixture, 'stage', first);
  await invoke(fixture, 'activate', first);
  const firstCurrent = await readlink(join(fixture.pointerRoot, 'current'));

  const second = await createArtifact(fixture, 'same-output', '8'.repeat(40));
  assert.equal(second.treeDigest, first.treeDigest);
  await invoke(fixture, 'stage', second);
  await invoke(fixture, 'activate', second);
  const secondCurrent = await readlink(join(fixture.pointerRoot, 'current'));
  assert.notEqual(secondCurrent, firstCurrent);
  assert.match(secondCurrent, /8{40}-/);
  assert.equal(await readlink(join(fixture.pointerRoot, 'previous')), firstCurrent);
});

test('seeds the immutable rollback baseline once without activating a candidate', async () => {
  const fixture = await createFixture();
  const sourceSha = '3'.repeat(40);
  fixture.policy.nodes.local.deployments.app.allowFirstActivation = false;
  fixture.policy.nodes.local.deployments.app.seedDependencyLayer = {
    source: 'node_modules',
    runtime: 'node22-linux-x64-test',
    keyFiles: ['package-lock.json'],
    productionRoot: join(fixture.root, 'layers'),
  };
  await writeFile(join(fixture.policy.nodes.local.legacyRoot, 'package-lock.json'), '{"lockfileVersion":3}\n');
  await mkdir(join(fixture.policy.nodes.local.legacyRoot, 'node_modules', 'fixture'), { recursive: true });
  await writeFile(join(fixture.policy.nodes.local.legacyRoot, 'node_modules', 'fixture', 'index.js'), 'export {};\n');
  await writePolicy(fixture);
  const seeded = await invoke(fixture, 'seed', { sourceSha }, `fixture:seed-layout:${sourceSha}`);
  assert.equal(seeded.result.seeded, true);
  assert.match(await readlink(join(fixture.pointerRoot, 'current')), /seed-/);
  assert.match(await readlink(join(fixture.pointerRoot, 'runtime')), /\/layers\/[a-f0-9]{64}$/);
  await assert.rejects(
    () => invoke(fixture, 'seed', { sourceSha }, `fixture:seed-layout:${sourceSha}`),
    (error) => {
      assert.match(error.stderr, /CURRENT_POINTER_ALREADY_EXISTS/);
      return true;
    }
  );
});

test('adopts an unmanaged current directory as the immutable rollback baseline', async () => {
  const fixture = await createFixture();
  const sourceSha = '9'.repeat(40);
  const unmanagedCurrent = join(fixture.pointerRoot, 'current');
  await mkdir(unmanagedCurrent, { recursive: true });
  await writeFile(join(unmanagedCurrent, 'app.txt'), 'existing runtime\n');

  const seeded = await invoke(fixture, 'seed', { sourceSha }, `fixture:seed-layout:${sourceSha}`);

  const current = await readlink(join(fixture.pointerRoot, 'current'));
  assert.equal(seeded.result.seeded, true);
  assert.match(current, /seed-/);
  assert.equal(await readFile(join(current, 'app.txt'), 'utf8'), 'existing runtime\n');
});

test('candidate lookup tolerates an unmanaged current directory without replacing it', async () => {
  const fixture = await createFixture();
  await mkdir(join(fixture.pointerRoot, 'current'), { recursive: true });
  await writeFile(join(fixture.pointerRoot, 'current', 'legacy.txt'), 'legacy-current\n');
  const artifact = await createArtifact(fixture, 'candidate-for-unmanaged-current', 'd'.repeat(40));
  const lookup = await invoke(fixture, 'lookup', artifact);
  assert.equal(lookup.result.current, null);
  assert.equal(await readFile(join(fixture.pointerRoot, 'current', 'legacy.txt'), 'utf8'), 'legacy-current\n');
});

test('imports an explicitly allowed candidate as a rollback baseline without restarting', async () => {
  const fixture = await createFixture();
  fixture.policy.nodes.local.deployments.app.allowBaselineImport = true;
  await writePolicy(fixture);
  const artifact = await createArtifact(fixture, 'imported-baseline', 'e'.repeat(40));
  await invoke(fixture, 'stage', artifact);
  const args = [agent, 'baseline', '--project', 'fixture', '--node', 'local', '--target', 'app', '--source-sha', artifact.sourceSha, '--approval', `fixture:baseline:${artifact.sourceSha}`];
  const imported = await execFileAsync(process.execPath, args, { env: { ...process.env, AI_DELIVERY_POLICY_ROOT: fixture.policyRoot }, maxBuffer: 1024 * 1024 });
  assert.equal(JSON.parse(imported.stdout).result.imported, true);
  assert.equal(await readlink(join(fixture.pointerRoot, 'current')), await readlink(join(fixture.pointerRoot, 'candidate')));
});

test('L0 and L1 target pointers remain independent in both directions', async () => {
  const fixture = await createFixture();
  const l0 = await createArtifact(fixture, 'l0', '5'.repeat(40));
  await invoke(fixture, 'stage', l0, null, 'local');
  await invoke(fixture, 'activate', l0, null, 'local');
  const l0Current = await readlink(join(fixture.pointerRoot, 'current'));
  await assert.rejects(() => readlink(join(fixture.peerPointerRoot, 'current')), { code: 'ENOENT' });

  const l1 = await createArtifact(fixture, 'l1', '6'.repeat(40));
  await invoke(fixture, 'stage', l1, null, 'peer');
  await invoke(fixture, 'activate', l1, null, 'peer');
  assert.equal(await readlink(join(fixture.pointerRoot, 'current')), l0Current);
  assert.match(await readlink(join(fixture.peerPointerRoot, 'current')), new RegExp(l1.treeDigest.slice(7)));
});

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-remote-'));
  const policyRoot = join(root, 'policy');
  const pointerRoot = join(root, 'deployments', 'app');
  const peerPointerRoot = join(root, 'deployments', 'peer');
  const legacyRoot = join(root, 'legacy');
  await mkdir(legacyRoot, { recursive: true });
  await writeFile(join(legacyRoot, 'app.txt'), 'legacy');
  const fixture = {
    root,
    policyRoot,
    pointerRoot,
    peerPointerRoot,
    policy: {
      schema: 'ai.delivery.remote-policy.v1',
      project: 'fixture',
      allowedRoots: [root],
      incomingRoot: root,
      auditRoot: join(root, 'audit'),
      minimumFreeBytes: 1,
      readiness: { timeoutMs: 1_000, intervalMs: 20, attemptTimeoutMs: 250, hardFailureGraceMs: 50 },
      allowedDependencyRoots: [join(root, 'layers')],
      protectedProcesses: [],
      nodes: {
        local: {
          legacyRoot,
          deployments: {
            app: {
              pointerRoot,
              allowFirstActivation: true,
              seedInputs: [{ source: 'app.txt', destination: 'app.txt' }],
              restart: { kind: 'none', name: 'none' },
              candidateChecks: [{ argv: ['test', '-f', '{{candidateDir}}/app.txt'] }],
              healthChecks: [{ argv: [process.execPath, '-e', 'process.exit(0)'] }],
            },
          },
        },
        peer: {
          deployments: {
            app: {
              pointerRoot: peerPointerRoot,
              allowFirstActivation: true,
              restart: { kind: 'none', name: 'none' },
              candidateChecks: [{ argv: ['test', '-f', '{{candidateDir}}/app.txt'] }],
              healthChecks: [{ argv: [process.execPath, '-e', 'process.exit(0)'] }],
            },
          },
        },
      },
    },
  };
  await writePolicy(fixture);
  return fixture;
}

async function assertTraversable(fixture) {
  assert.equal((await lstat(dirname(fixture.pointerRoot))).mode & 0o777, 0o755);
  assert.equal((await lstat(fixture.pointerRoot)).mode & 0o777, 0o755);
}

async function writePolicy(fixture) {
  await mkdir(fixture.policyRoot, { recursive: true });
  await writeFile(join(fixture.policyRoot, 'fixture.json'), `${JSON.stringify(fixture.policy, null, 2)}\n`);
}

async function createArtifact(fixture, contents, sourceSha, dependencyLayer = null) {
  const directory = join(fixture.root, 'sources', sourceSha);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'app.txt'), contents);
  const evidence = { target: 'app', directory, deletions: [], ...(await treeEvidence(directory, ['app.txt'])) };
  const adapter = { project: 'fixture', projectRoot: fixture.root, targets: { app: { kind: 'frontend', criticalFiles: ['app.txt'], dependencyLayer } } };
  const plan = { to: { sha: sourceSha }, planDigest: digest({ sourceSha }) };
  return packageTarget(adapter, plan, evidence, join(fixture.root, 'runs', sourceSha), join(fixture.root, 'artifacts'));
}

function migrationDeployment(fixture, environmentFile) {
  return {
    pointerRoot: fixture.pointerRoot,
    allowFirstActivation: true,
    restart: { kind: 'none', name: 'none' },
    candidateChecks: [{ argv: ['test', '-f', '{{candidateDir}}/executor/DatabaseMigrationExecutor.js'] }, { argv: ['test', '-d', '{{candidateDir}}/database/supabase/migrations'] }],
    healthChecks: [],
    databaseMigration: {
      executionRoot: join(fixture.root, 'execution-releases'),
      environmentFile,
      runner: 'executor/DatabaseMigrationExecutor.js',
      migrationDirectory: 'database/supabase/migrations',
      nodeBinary: process.execPath,
      timeoutMs: 10_000,
      recovery: { mode: 'forward-only', snapshot: 'not-captured-by-delivery-engine' },
    },
  };
}

async function createMigrationArtifact(fixture, sourceSha) {
  const directory = join(fixture.root, 'migration-sources', sourceSha);
  await mkdir(join(directory, 'executor'), { recursive: true });
  await mkdir(join(directory, 'database', 'supabase', 'migrations'), { recursive: true });
  await mkdir(join(directory, 'database', 'contracts'), { recursive: true });
  await writeFile(join(directory, 'database', 'supabase', 'migrations', '20990101000000_first.sql'), 'select 1;\n');
  await writeFile(join(directory, 'database', 'supabase', 'migrations', '20990102000000_second.sql'), 'select 2;\n');
  await writeFile(join(directory, 'database', 'contracts', 'history.json'), '{}\n');
  await writeFile(
    join(directory, 'executor', 'DatabaseMigrationExecutor.js'),
    `
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const ledgerPath = process.env.AI_TEST_LEDGER;
if (process.env.AI_TEST_EXPECT_OWNER === '1' && (process.env.DATABASE_MIGRATION_EXECUTION_MODE !== 'database-owner'
  || process.env.MIGRATION_OWNER_DATABASE_HOST !== '127.0.0.1'
  || process.env.MIGRATION_OWNER_DATABASE_PORT !== '55432'
  || process.env.AI_TEST_OWNER_CREDENTIAL !== 'fixture-owner-secret')) throw new Error('FIXTURE_OWNER_ENVIRONMENT_INVALID');
const beforeRecords = JSON.parse(await readFile(ledgerPath, 'utf8'));
const files = (await readdir(process.env.MIGRATION_DIRECTORY)).filter((name) => /^\\d{14}_.+\\.sql$/.test(name)).sort();
const selected = files.filter((file) => !beforeRecords.some((row) => row.version === file.slice(0, 14))).map((file) => ({ file, version: file.slice(0, 14), sha256: createHash('sha256').update(file).digest('hex') }));
const evidence = (records) => ({ exists: true, count: records.length, head: records.at(-1)?.version ?? null, sha256: createHash('sha256').update(JSON.stringify(records)).digest('hex'), records });
if (process.env.AI_TEST_FAIL === '1') {
  process.stdout.write(JSON.stringify({ schema: 'ai.delivery.database-migration-result.v1', sourceSha: process.env.AI_DELIVERY_SOURCE_SHA, status: 'failed', selected, ledgerBefore: evidence(beforeRecords), ledgerAfter: evidence(beforeRecords), applied: [], error: { code: 'FIXTURE_FAILURE', message: 'FIXTURE_FAILURE' } }) + '\\n');
  process.exit(9);
}
const afterRecords = [...beforeRecords, ...selected.map((item) => ({ version: item.version, name: item.file, statements: [] }))];
await writeFile(ledgerPath, JSON.stringify(afterRecords));
process.stdout.write(JSON.stringify({ schema: 'ai.delivery.database-migration-result.v1', sourceSha: process.env.AI_DELIVERY_SOURCE_SHA, status: selected.length ? 'applied' : 'noop', selected, ledgerBefore: evidence(beforeRecords), ledgerAfter: evidence(afterRecords), applied: selected, error: null }) + '\\n');
`
  );
  const evidence = { target: 'app', directory, deletions: [], ...(await treeEvidence(directory, ['executor/DatabaseMigrationExecutor.js'])) };
  const adapter = { project: 'fixture', projectRoot: fixture.root, targets: { app: { kind: 'migration', criticalFiles: ['executor/DatabaseMigrationExecutor.js'], dependencyLayer: null } } };
  const plan = { to: { sha: sourceSha }, planDigest: digest({ sourceSha }) };
  return packageTarget(adapter, plan, evidence, join(fixture.root, 'runs', sourceSha), join(fixture.root, 'artifacts'));
}

async function materializeLayer(fixture, artifact, layerConfig) {
  const layer = join(layerConfig.productionRoot, artifact.dependencyLayer.digest.slice(7));
  await mkdir(layer, { recursive: true });
  await writeFile(
    join(layer, 'AI_DELIVERY_LAYER.json'),
    `${JSON.stringify({
      schema: 'ai.delivery.dependency-layer.v1',
      digest: artifact.dependencyLayer.digest,
      runtime: layerConfig.runtime,
    })}\n`
  );
  return layer;
}

async function captureAgentFailure(action) {
  try {
    await action();
  } catch (error) {
    return JSON.parse(error.stderr).error;
  }
  assert.fail('Expected remote agent action to fail');
}

async function waitForCurrent(pointerRoot, sourceSha) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await readlink(join(pointerRoot, 'current'))).includes(sourceSha)) return;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
  }
  assert.fail(`current did not move to ${sourceSha}`);
}

async function invoke(fixture, action, artifact, approval = null, node = 'local', expectedCurrent = undefined) {
  const args = [agent, action, '--project', 'fixture', '--node', node, '--target', 'app'];
  if (action === 'stage' || action === 'stage-direct') {
    args.push('--archive', artifact.archive.path, '--manifest', artifact.manifestPath, '--sha256', artifact.archive.sha256.slice(7), '--tree-digest', artifact.treeDigest);
  } else if (action === 'lookup' || action === 'reuse' || action === 'reuse-direct') {
    args.push('--source-sha', artifact.sourceSha, '--sha256', artifact.archive.sha256.slice(7), '--tree-digest', artifact.treeDigest, '--manifest-digest', artifact.manifestDigest);
  } else if (action === 'activate') {
    let current = expectedCurrent;
    if (current === undefined) {
      try {
        current = await readlink(join(node === 'local' ? fixture.pointerRoot : fixture.peerPointerRoot, 'current'));
      } catch (error) {
        if (error?.code === 'ENOENT') current = 'none';
        else throw error;
      }
    }
    args.push('--approval', approval ?? `fixture:${artifact.sourceSha}`, '--expected-current', current);
  } else if (action === 'activate-direct') {
    args.push('--source-sha', artifact.sourceSha);
  } else if (action === 'seed') {
    args.push('--source-sha', artifact.sourceSha, '--approval', approval ?? `fixture:seed-layout:${artifact.sourceSha}`);
  }
  const result = await execFileAsync(process.execPath, args, {
    env: { ...process.env, ...(fixture.environment ?? {}), AI_DELIVERY_POLICY_ROOT: fixture.policyRoot },
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(result.stdout);
}

async function invokeObserve(fixture, targets, node = 'local') {
  const result = await execFileAsync(process.execPath, [agent, 'observe', '--project', 'fixture', '--node', node, '--targets', targets.join(',')], {
    env: { ...process.env, ...(fixture.environment ?? {}), AI_DELIVERY_POLICY_ROOT: fixture.policyRoot },
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(result.stdout);
}

async function artifactPayload(artifact) {
  const [archive, manifest] = await Promise.all([readFile(artifact.archive.path), readFile(artifact.manifestPath)]);
  return {
    artifactUrl: `data:application/gzip;base64,${archive.toString('base64')}`,
    manifestUrl: `data:application/json;base64,${manifest.toString('base64')}`,
  };
}

async function invokeOss(fixture, artifact, payload, includeControlPlane = true, action = 'deploy-oss-direct') {
  const args = [
    agent,
    action,
    '--project',
    'fixture',
    '--node',
    'local',
    '--target',
    'app',
    '--source-sha',
    artifact.sourceSha,
    '--sha256',
    artifact.archive.sha256.slice(7),
    '--tree-digest',
    artifact.treeDigest,
    '--manifest-digest',
    artifact.manifestDigest,
  ];
  if (includeControlPlane) {
    args.push('--control-sha', 'f'.repeat(40), '--github-run-id', '123456', '--github-run-attempt', '2');
  }
  return new Promise((resolveInvoke, rejectInvoke) => {
    const child = spawn(process.execPath, args, {
      env: { ...process.env, ...(fixture.environment ?? {}), AI_DELIVERY_POLICY_ROOT: fixture.policyRoot },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', rejectInvoke);
    child.on('close', (status) => {
      const output = Buffer.concat(stdout).toString('utf8');
      const errorOutput = Buffer.concat(stderr).toString('utf8');
      if (status === 0) resolveInvoke(JSON.parse(output));
      else {
        const error = new Error(`remote agent exited ${status}`);
        error.stdout = output;
        error.stderr = errorOutput;
        rejectInvoke(error);
      }
    });
    child.stdin.end(`${JSON.stringify(payload)}\n`);
  });
}
