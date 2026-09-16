#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, lstat, mkdir, readFile, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = process.env.AI_DELIVERY_FIXTURE_ROOT;
const agent = process.env.AI_DELIVERY_FIXTURE_AGENT;
const port = Number(process.env.AI_DELIVERY_FIXTURE_PORT);
const unit = process.env.AI_DELIVERY_FIXTURE_UNIT;
const unitStem = unit?.endsWith('.service') ? unit.slice(0, -'.service'.length) : 'invalid';
const sentinelUnits = {
  gateway: `${unitStem}-gateway.service`,
  tunnel: `${unitStem}-tunnel.service`,
  unrelated: `${unitStem}-unrelated.service`,
};
const isolatedUnits = [unit, ...Object.values(sentinelUnits)];
const project = 'readiness-fixture';
const node = 'isolated';
const targetName = 'storefront';
const pointerRoot = join(root ?? '', 'target');
const policyRoot = join(root ?? '', 'policy');
const baselineLayerDigest = `sha256:${'1'.repeat(64)}`;
const candidateLayerDigest = `sha256:${'2'.repeat(64)}`;
const protectedUnits = [
  'sfl-storefront@hbbtzn-l1.service',
  'sfl-identity-api@hbbtzn-l1.service',
  'sfl-purchase-api@hbbtzn-l1.service',
  'sfl-web-api@hbbtzn-l1.service',
  'sfl-catalog-api@hbbtzn-l1.service',
  'sfl-catalog-jobs@hbbtzn-l1.service',
  'sfl-payment-webhook-api@hbbtzn-l1.service',
  'sfl-payment-jobs@hbbtzn-l1.service',
  'sfl-api-gateway@hbbtzn-l1.service',
  'sfl-cloudflared@hbbtzn-l1.service',
];
const productionPointers = [
  '/opt/sfl/nodes/hbbtzn-l1/current',
  '/opt/sfl/nodes/hbbtzn-l1/targets/storefront/current',
  '/opt/sfl/nodes/hbbtzn-l1/targets/storefront/candidate',
  '/opt/sfl/nodes/hbbtzn-l1/targets/storefront/runtime',
];
const serverSource = `import http from 'node:http';
import { readFile } from 'node:fs/promises';
const behavior = JSON.parse(await readFile(new URL('./behavior.json', import.meta.url), 'utf8'));
const port = Number(process.argv[2]);
if (behavior.mode === 'hard-fail') process.exit(7);
const started = Date.now();
const server = http.createServer((_request, response) => {
  const ready = behavior.mode === 'ready' || behavior.mode === 'delayed-listen' || (behavior.mode === 'eventual-ready' && Date.now() - started >= behavior.delayMs);
  response.statusCode = ready ? 200 : 503;
  response.setHeader('content-type', 'text/plain');
  response.end(ready ? 'READY' : 'NOT_READY');
});
const listen = () => server.listen(port, '127.0.0.1');
if (behavior.mode === 'delayed-listen') setTimeout(listen, behavior.delayMs);
else listen();
`;

try {
  validateInputs();
  const evidence = await executeFixture();
  const cleanup = await cleanupFixture();
  process.stdout.write(`${JSON.stringify({ ok: true, evidence, cleanup }, null, 2)}\n`);
} catch (error) {
  const cleanup = await cleanupFixture().catch((cleanupError) => ({ error: cleanupError.message }));
  process.stderr.write(`${JSON.stringify({ ok: false, error: { message: error.message, stack: error.stack }, cleanup }, null, 2)}\n`);
  process.exitCode = 1;
}

function validateInputs() {
  assert.equal(process.platform, 'linux');
  assert.equal(process.getuid?.(), 0);
  assert.match(root ?? '', /^\/opt\/ai-delivery\/fixtures\/readiness-[A-Za-z0-9-]+$/);
  assert.match(agent ?? '', /^\/opt\/ai-delivery\/fixtures\/readiness-[A-Za-z0-9-]+\/agent\.mjs$/);
  assert.match(unit ?? '', /^ai-delivery-readiness-[A-Za-z0-9-]+\.service$/);
  for (const sentinel of Object.values(sentinelUnits)) assert.match(sentinel, /^ai-delivery-readiness-[A-Za-z0-9-]+-(gateway|tunnel|unrelated)\.service$/);
  assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
}

async function executeFixture() {
  const sockets = await run('ss', ['-H', '-ltn']);
  assert.doesNotMatch(sockets.stdout, new RegExp(`:${port}(?:\\s|$)`));
  const loadState = await systemdProperty('LoadState');
  assert.equal(loadState, 'not-found');

  const productionBefore = {
    pointers: await pointerSnapshot(productionPointers),
    processes: await processSnapshot(protectedUnits),
  };
  await prepareLayout();
  await startStoppedTarget();
  await startSentinelUnits();
  await waitForHttp(200, 5_000);
  await assertUnitsActive(isolatedUnits);
  const unitProperties = await systemdProperties(['DynamicUser', 'User', 'WorkingDirectory', 'ProtectSystem', 'ReadOnlyPaths', 'PrivateTmp', 'NoNewPrivileges']);
  assert.equal(unitProperties.DynamicUser, 'yes');
  assert.equal(unitProperties.ProtectSystem, 'strict');
  const dependencyGraph = {
    gateway: await systemdProperties(['Requires', 'Wants', 'After'], sentinelUnits.gateway),
    tunnel: await systemdProperties(['Requires', 'Wants', 'After'], sentinelUnits.tunnel),
  };
  assert.doesNotMatch(dependencyGraph.gateway.Requires, new RegExp(escapeRegex(unit)));
  assert.match(dependencyGraph.gateway.Wants, new RegExp(escapeRegex(unit)));
  assert.match(dependencyGraph.gateway.After, new RegExp(escapeRegex(unit)));
  assert.doesNotMatch(dependencyGraph.tunnel.Requires, new RegExp(escapeRegex(sentinelUnits.gateway)));
  assert.match(dependencyGraph.tunnel.Wants, new RegExp(escapeRegex(sentinelUnits.gateway)));
  assert.match(dependencyGraph.tunnel.After, new RegExp(escapeRegex(sentinelUnits.gateway)));
  const isolatedInitial = await processSnapshot(isolatedUnits);
  for (const [name, pid] of Object.entries(isolatedInitial)) assert.notEqual(pid, '0', `${name} must have a live PID`);

  const baseline = join(pointerRoot, 'releases', 'baseline');
  const eventual = join(pointerRoot, 'releases', 'eventual');
  const hardFailure = join(pointerRoot, 'releases', 'hard-failure');
  const timeout = join(pointerRoot, 'releases', 'timeout');
  const baselineRuntime = layerPath(baselineLayerDigest);

  await atomicPointer(join(pointerRoot, 'candidate'), eventual);
  const delayed = await agentAction('activate', [
    '--approval', `${project}:${'b'.repeat(40)}`,
    '--expected-current', baseline,
  ]);
  assert.equal(delayed.result.readiness.status, 'ready');
  assert.ok(delayed.result.readiness.durationMs >= 1_500 && delayed.result.readiness.durationMs < 30_000, JSON.stringify(delayed.result.readiness));
  assert.ok(delayed.result.readiness.attempts > 1);
  assert.match(delayed.result.readiness.lastError.details.outputTail, /503/);
  assert.equal(delayed.result.restart.commandCount, 1);
  assert.equal(delayed.result.restart.target, unit);
  const isolatedAfterActivation = await processSnapshot(isolatedUnits);
  assert.notEqual(isolatedAfterActivation[unit], isolatedInitial[unit]);
  assertSentinelsUnchanged(isolatedInitial, isolatedAfterActivation);

  const verified = await agentAction('activate', [
    '--approval', `${project}:${'b'.repeat(40)}`,
    '--expected-current', eventual,
  ]);
  assert.equal(verified.result.mode, 'verify-only');
  assert.equal(verified.result.restart.commandCount, 0);
  const isolatedAfterVerify = await processSnapshot(isolatedUnits);
  assert.deepEqual(isolatedAfterVerify, isolatedAfterActivation);

  const restored = await agentAction('rollback');
  assert.equal(restored.result.current, baseline);
  assert.equal(restored.result.runtime, baselineRuntime);
  assert.equal(restored.result.readiness.status, 'ready');
  assert.ok(restored.result.readiness.attempts > 1);
  assert.equal(restored.result.restart.commandCount, 1);
  assert.equal(restored.result.restart.target, unit);
  const isolatedAfterRollback = await processSnapshot(isolatedUnits);
  assert.notEqual(isolatedAfterRollback[unit], isolatedAfterVerify[unit]);
  assertSentinelsUnchanged(isolatedInitial, isolatedAfterRollback);

  await atomicPointer(join(pointerRoot, 'candidate'), hardFailure);
  const hard = await failedAgentAction('activate', [
    '--approval', `${project}:${'c'.repeat(40)}`,
    '--expected-current', baseline,
  ]);
  assert.equal(hard.code, 'CUTOVER_FAILED_AND_ROLLED_BACK', JSON.stringify(hard, null, 2));
  assert.equal(hard.details.candidateFailure.code, 'READINESS_HARD_FAILURE');
  assert.ok(hard.details.rollback.triggerDelayMs <= 3_000);
  assert.equal(hard.details.rollback.finalCurrent, baseline);
  assert.equal(hard.details.rollback.finalRuntime, baselineRuntime);
  assert.equal(hard.details.rollback.readiness.status, 'ready');
  assert.equal(hard.details.restartCommands.total, 2);
  assert.equal(hard.details.restartCommands.candidate.target, unit);
  assert.equal(hard.details.restartCommands.rollback.target, unit);
  assertSentinelsUnchanged(isolatedInitial, await processSnapshot(isolatedUnits));

  await atomicPointer(join(pointerRoot, 'candidate'), timeout);
  const timedOut = await failedAgentAction('activate', [
    '--approval', `${project}:${'d'.repeat(40)}`,
    '--expected-current', baseline,
  ]);
  assert.equal(timedOut.code, 'CUTOVER_FAILED_AND_ROLLED_BACK', JSON.stringify(timedOut, null, 2));
  assert.equal(timedOut.details.candidateFailure.code, 'READINESS_TIMEOUT');
  assert.ok(timedOut.details.candidateFailure.details.durationMs >= 30_000);
  assert.ok(timedOut.details.candidateFailure.details.durationMs < 32_000);
  assert.ok(timedOut.details.rollback.triggerDelayMs <= 3_000);
  assert.equal(timedOut.details.rollback.finalCurrent, baseline);
  assert.equal(timedOut.details.rollback.finalRuntime, baselineRuntime);
  assert.equal(timedOut.details.rollback.readiness.status, 'ready');
  assert.equal(timedOut.details.restartCommands.total, 2);
  assertSentinelsUnchanged(isolatedInitial, await processSnapshot(isolatedUnits));

  const lifecycle = await exerciseIsolatedLifecycle(isolatedInitial);

  const productionAfter = {
    pointers: await pointerSnapshot(productionPointers),
    processes: await processSnapshot(protectedUnits),
  };
  assert.deepEqual(productionAfter, productionBefore);
  return {
    productionBefore,
    productionAfter,
    unitProperties,
    dependencyGraph,
    isolatedInitial,
    isolatedAfterActivation,
    isolatedAfterVerify,
    isolatedAfterRollback,
    lifecycle,
    delayedReadiness: delayed.result.readiness,
    verifyOnly: verified.result,
    rollbackReadiness: restored.result.readiness,
    hardFailure: hard.details,
    timeoutFailure: timedOut.details,
  };
}

async function prepareLayout() {
  await mkdir(join(pointerRoot, 'releases'), { recursive: true, mode: 0o755 });
  await mkdir(policyRoot, { recursive: true, mode: 0o755 });
  await mkdir(join(root, 'incoming'), { recursive: true, mode: 0o755 });
  await chmod(dirname(pointerRoot), 0o755);
  await chmod(pointerRoot, 0o755);
  const baselineLayer = await createLayer(baselineLayerDigest);
  await createLayer(candidateLayerDigest);
  const baseline = await createRelease('baseline', 'a'.repeat(40), { mode: 'delayed-listen', delayMs: 1_000 }, baselineLayerDigest);
  await createRelease('eventual', 'b'.repeat(40), { mode: 'eventual-ready', delayMs: 2_000 }, candidateLayerDigest);
  await createRelease('hard-failure', 'c'.repeat(40), { mode: 'hard-fail' }, candidateLayerDigest);
  await createRelease('timeout', 'd'.repeat(40), { mode: 'unready' }, candidateLayerDigest);
  await atomicPointer(join(pointerRoot, 'current'), baseline);
  await atomicPointer(join(pointerRoot, 'runtime'), baselineLayer);
  const policy = {
    schema: 'ai.delivery.remote-policy.v1',
    project,
    allowedRoots: [root],
    allowedDependencyRoots: [join(root, 'layers')],
    incomingRoot: join(root, 'incoming'),
    auditRoot: join(root, 'audit'),
    readiness: { timeoutMs: 30000, intervalMs: 500, attemptTimeoutMs: 3000, hardFailureGraceMs: 1000 },
    protectedProcesses: [...protectedUnits, ...Object.values(sentinelUnits)].map((name) => ({ kind: 'systemd', name })),
    nodes: {
      [node]: {
        deployments: {
          [targetName]: {
            pointerRoot,
            restart: { kind: 'systemd', name: unit, jobMode: 'ignore-dependencies' },
            candidateChecks: [{ argv: ['/usr/bin/node', '--check', '{{candidateDir}}/server.mjs'] }],
            healthChecks: [{ argv: ['/usr/bin/curl', '-fsS', '--max-time', '1', `http://127.0.0.1:${port}/`] }],
          },
        },
      },
    },
  };
  await writeFile(join(policyRoot, `${project}.json`), `${JSON.stringify(policy, null, 2)}\n`, { mode: 0o600 });
}

async function createRelease(name, sourceSha, behavior, dependencyDigest) {
  const release = join(pointerRoot, 'releases', name);
  await mkdir(release, { recursive: true, mode: 0o755 });
  await writeFile(join(release, 'server.mjs'), serverSource, { mode: 0o555 });
  await writeFile(join(release, 'behavior.json'), `${JSON.stringify(behavior)}\n`, { mode: 0o444 });
  await writeFile(join(release, 'AI_DELIVERY_ARTIFACT.json'), `${JSON.stringify({
    schema: 'ai.delivery.artifact.v1',
    engineVersion: 2,
    sourceSha,
    dependencyLayer: { digest: dependencyDigest, runtime: 'node22-linux-x64-fixture', productionRoot: join(root, 'layers') },
  }, null, 2)}\n`, { mode: 0o444 });
  await chmod(release, 0o755);
  return release;
}

async function createLayer(digest) {
  const layer = layerPath(digest);
  await mkdir(layer, { recursive: true, mode: 0o755 });
  await writeFile(join(layer, 'AI_DELIVERY_LAYER.json'), `${JSON.stringify({
    schema: 'ai.delivery.dependency-layer.v1',
    digest,
    runtime: 'node22-linux-x64-fixture',
  })}\n`, { mode: 0o444 });
  return layer;
}

function layerPath(digest) {
  return join(root, 'layers', digest.slice(7));
}

async function startTransientUnit() {
  await run('systemd-run', [
    '--quiet',
    `--unit=${unit}`,
    '--property=Type=simple',
    '--property=DynamicUser=yes',
    `--property=WorkingDirectory=${pointerRoot}/current`,
    '--property=Restart=no',
    '--property=TimeoutStartSec=30',
    '--property=TimeoutStopSec=30',
    '--property=UMask=0027',
    '--property=NoNewPrivileges=yes',
    '--property=PrivateTmp=yes',
    '--property=ProtectSystem=strict',
    '--property=ProtectHome=yes',
    '--property=ProtectKernelTunables=yes',
    '--property=ProtectKernelModules=yes',
    '--property=ProtectControlGroups=yes',
    '--property=RestrictSUIDSGID=yes',
    '--property=PrivateDevices=yes',
    '--property=ProtectClock=yes',
    '--property=ProtectHostname=yes',
    '--property=RestrictNamespaces=yes',
    '--property=RestrictRealtime=yes',
    '--property=LockPersonality=yes',
    '--property=CapabilityBoundingSet=',
    '--property=SystemCallArchitectures=native',
    '--property=RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6',
    `--property=ReadOnlyPaths=${pointerRoot}`,
    '/usr/bin/node',
    join(pointerRoot, 'current', 'server.mjs'),
    String(port),
  ]);
}

async function startSentinelUnits() {
  await startSentinelUnit(sentinelUnits.gateway, [`Wants=${unit}`, `After=${unit}`]);
  await startSentinelUnit(sentinelUnits.tunnel, [`Wants=${sentinelUnits.gateway}`, `After=${sentinelUnits.gateway}`]);
  await startSentinelUnit(sentinelUnits.unrelated, []);
}

async function startStoppedTarget() {
  const loadState = await systemdProperty('LoadState', unit).catch(() => 'not-found');
  if (loadState === 'loaded') await run('systemctl', ['start', unit]);
  else await startTransientUnit();
}

async function startSentinelUnit(name, dependencies) {
  await run('systemd-run', [
    '--quiet',
    `--unit=${name}`,
    '--property=Type=simple',
    '--property=DynamicUser=yes',
    '--property=Restart=no',
    '--property=NoNewPrivileges=yes',
    '--property=PrivateTmp=yes',
    ...dependencies.map((dependency) => `--property=${dependency}`),
    '/usr/bin/sleep',
    'infinity',
  ]);
}

async function exerciseIsolatedLifecycle(initial) {
  const beforeTargetStop = await processSnapshot(isolatedUnits);
  await run('systemctl', ['stop', unit]);
  await waitForUnitStopped(unit, 5_000);
  const afterTargetStop = await processSnapshot(isolatedUnits);
  assert.equal(afterTargetStop[unit], '0');
  assertSentinelsUnchanged(initial, afterTargetStop);
  await assertUnitsActive(Object.values(sentinelUnits));

  await startStoppedTarget();
  await waitForHttp(200, 5_000);
  const afterTargetRestart = await processSnapshot(isolatedUnits);
  assert.notEqual(afterTargetRestart[unit], beforeTargetStop[unit]);
  assertSentinelsUnchanged(initial, afterTargetRestart);

  const beforeGatewayRestart = await processSnapshot(isolatedUnits);
  await run('systemctl', ['restart', sentinelUnits.gateway]);
  await waitForUnitState(sentinelUnits.gateway, 'active', 5_000);
  const afterGatewayRestart = await processSnapshot(isolatedUnits);
  assert.notEqual(afterGatewayRestart[sentinelUnits.gateway], beforeGatewayRestart[sentinelUnits.gateway]);
  assert.equal(afterGatewayRestart[unit], beforeGatewayRestart[unit]);
  assert.equal(afterGatewayRestart[sentinelUnits.tunnel], beforeGatewayRestart[sentinelUnits.tunnel]);
  assert.equal(afterGatewayRestart[sentinelUnits.unrelated], beforeGatewayRestart[sentinelUnits.unrelated]);

  const beforeTunnelRestart = await processSnapshot(isolatedUnits);
  await run('systemctl', ['restart', sentinelUnits.tunnel]);
  await waitForUnitState(sentinelUnits.tunnel, 'active', 5_000);
  const afterTunnelRestart = await processSnapshot(isolatedUnits);
  assert.notEqual(afterTunnelRestart[sentinelUnits.tunnel], beforeTunnelRestart[sentinelUnits.tunnel]);
  assert.equal(afterTunnelRestart[unit], beforeTunnelRestart[unit]);
  assert.equal(afterTunnelRestart[sentinelUnits.gateway], beforeTunnelRestart[sentinelUnits.gateway]);
  assert.equal(afterTunnelRestart[sentinelUnits.unrelated], beforeTunnelRestart[sentinelUnits.unrelated]);

  return { beforeTargetStop, afterTargetStop, afterTargetRestart, beforeGatewayRestart, afterGatewayRestart, beforeTunnelRestart, afterTunnelRestart };
}

async function agentAction(action, extra = []) {
  const result = await run('/usr/bin/node', [agent, action, '--project', project, '--node', node, '--target', targetName, ...extra], {
    env: { ...process.env, AI_DELIVERY_POLICY_ROOT: policyRoot },
  });
  return JSON.parse(result.stdout);
}

async function failedAgentAction(action, extra = []) {
  try {
    await agentAction(action, extra);
  } catch (error) {
    return JSON.parse(error.stderr).error;
  }
  assert.fail(`Expected ${action} to fail`);
}

async function waitForHttp(expected, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await httpStatus().catch(() => 0);
    if (status === expected) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  assert.fail(`HTTP fixture did not reach ${expected}`);
}

async function waitForUnitState(targetUnit, expected, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await systemdProperty('ActiveState', targetUnit) === expected) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  assert.fail(`${targetUnit} did not reach ${expected}`);
}

async function waitForUnitStopped(targetUnit, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await systemdProperty('ActiveState', targetUnit).catch(() => 'not-found');
    if (state === 'inactive' || state === 'failed' || state === 'not-found' || state === '') return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  assert.fail(`${targetUnit} did not stop`);
}

async function assertUnitsActive(units) {
  for (const targetUnit of units) assert.equal(await systemdProperty('ActiveState', targetUnit), 'active', targetUnit);
}

function assertSentinelsUnchanged(expected, actual) {
  for (const sentinel of Object.values(sentinelUnits)) assert.equal(actual[sentinel], expected[sentinel], sentinel);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function httpStatus() {
  return new Promise((resolvePromise, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/', timeout: 500 }, (response) => {
      response.resume();
      resolvePromise(response.statusCode ?? 0);
    });
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', reject);
  });
}

async function processSnapshot(units) {
  return Object.fromEntries(await Promise.all(units.map(async (name) => [name, await systemdProperty('MainPID', name)])));
}

async function pointerSnapshot(paths) {
  return Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await readlink(path)])));
}

async function systemdProperty(property, targetUnit = unit) {
  const result = await run('systemctl', ['show', `--property=${property}`, '--value', targetUnit], { acceptExitCodes: [0, 3] });
  return result.stdout.trim();
}

async function systemdProperties(properties, targetUnit = unit) {
  const result = await run('systemctl', ['show', ...properties.map((property) => `--property=${property}`), targetUnit]);
  return Object.fromEntries(result.stdout.trim().split('\n').filter(Boolean).map((line) => line.split(/=(.*)/s).slice(0, 2)));
}

async function atomicPointer(link, target) {
  const temporary = `${link}.${process.pid}.${Date.now()}`;
  await symlink(target, temporary);
  await rename(temporary, link);
}

async function cleanupFixture() {
  for (const targetUnit of isolatedUnits.filter(Boolean).reverse()) {
    await run('systemctl', ['stop', targetUnit], { acceptExitCodes: [0, 3, 4, 5] }).catch(() => {});
    await run('systemctl', ['reset-failed', targetUnit], { acceptExitCodes: [0, 1, 3, 4, 5] }).catch(() => {});
  }
  if (root && /^\/opt\/ai-delivery\/fixtures\/readiness-[A-Za-z0-9-]+$/.test(root)) await rm(root, { recursive: true, force: true });
  let rootExists = false;
  if (root) {
    try { await lstat(root); rootExists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const unitLoadStates = Object.fromEntries(await Promise.all(isolatedUnits.filter(Boolean).map(async (targetUnit) => [targetUnit, await systemdProperty('LoadState', targetUnit).catch(() => 'not-found')])));
  return { rootExists, unitLoadStates };
}

async function run(command, args, options = {}) {
  try {
    return await execFileAsync(command, args, { maxBuffer: 4 * 1024 * 1024, ...options });
  } catch (error) {
    if ((options.acceptExitCodes ?? []).includes(error.code)) return { stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
    throw error;
  }
}
