import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { cp, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import { materializeTarget, packageTarget } from './artifact.mjs';
import { DeliveryError, invariant } from './errors.mjs';
import { assertBuildRefIsCheckedOut, assertWorktreeClean, currentHead } from './git.mjs';
import { acquireLocks } from './lock.mjs';
import { createPlan } from './planner.mjs';
import { runCommand } from './runner.mjs';
import { createRun, readJson, statePaths, writeJson } from './state.mjs';

export async function planCommand(adapter, options) {
  const started = performance.now();
  const created = await createPlan(adapter, options);
  const plan = { ...created, timings: { plan: elapsed(started) } };
  const run = await createRun(adapter, plan);
  return { ...plan, runId: run.runId, planPath: join(run.directory, 'plan.json') };
}

export async function buildCommand(adapter, options) {
  const started = performance.now();
  const planPath = requiredPath(options.plan, 'BUILD_PLAN_REQUIRED');
  const plan = await readJson(planPath);
  invariant(plan.project === adapter.project, 'BUILD_PROJECT_MISMATCH', 'Plan belongs to another project');
  invariant(plan.deployRequired, 'BUILD_NOT_REQUIRED', 'Plan contains no deployable changes');
  await assertBuildRefIsCheckedOut(adapter.projectRoot, plan.to.sha);
  const runDirectory = dirname(planPath);
  const paths = statePaths(adapter);
  const release = await acquireLocks([join(paths.locks, 'build', `${plan.to.sha}.lock`)], {
    project: adapter.project,
    phase: 'build',
    sourceSha: plan.to.sha,
  });
  const phases = { preflight: [], tests: [], typecheck: [], build: [] };
  const timings = { preflight: 0, tests: 0, typecheck: 0, build: 0, materialize: 0 };
  const targetEvidence = [];
  try {
    for (const phase of ['preflight', 'tests', 'typecheck', 'build']) {
      let index = 0;
      for (const command of plan.actions[phase]) {
        const result = await runCommand(command, commandContext(adapter, plan, runDirectory, command.target, `${phase}-${index++}-${command.name}`));
        phases[phase].push(result);
        timings[phase] += result.durationMs;
      }
    }
    const materializeStarted = performance.now();
    for (const target of plan.targets) targetEvidence.push(await materializeTarget(adapter, target, runDirectory, plan.changes));
    timings.materialize = elapsed(materializeStarted);
    timings.total = elapsed(started);
    const evidence = {
      schema: 'ai.delivery.build.v1',
      project: adapter.project,
      runId: plan.runId ?? basename(runDirectory),
      sourceSha: plan.to.sha,
      planDigest: plan.planDigest,
      phases,
      targets: targetEvidence,
      timings,
      completedAt: new Date().toISOString(),
    };
    await writeJson(join(runDirectory, 'build.json'), evidence);
    return { ...evidence, buildPath: join(runDirectory, 'build.json') };
  } finally {
    await release();
  }
}

export async function packageCommand(adapter, options) {
  const started = performance.now();
  const buildPath = requiredPath(options.build, 'PACKAGE_BUILD_REQUIRED');
  const build = await readJson(buildPath);
  const runDirectory = dirname(buildPath);
  const plan = await readJson(join(runDirectory, 'plan.json'));
  invariant(build.sourceSha === plan.to.sha, 'PACKAGE_SOURCE_MISMATCH', 'Build and plan source differ');
  const artifacts = [];
  for (const target of build.targets) artifacts.push(await packageTarget(adapter, plan, target, runDirectory, statePaths(adapter).artifacts));
  const result = {
    schema: 'ai.delivery.package-set.v1',
    project: adapter.project,
    runId: build.runId,
    sourceSha: build.sourceSha,
    artifacts,
    timings: { package: elapsed(started), total: elapsed(started) },
    completedAt: new Date().toISOString(),
  };
  await writeJson(join(runDirectory, 'package.json'), result);
  return { ...result, packagePath: join(runDirectory, 'package.json') };
}

export async function deployCommand(adapter, options) {
  const started = performance.now();
  const packagePath = requiredPath(options.package, 'DEPLOY_PACKAGE_REQUIRED');
  const packageSet = await readJson(packagePath);
  invariant(packageSet.project === adapter.project, 'DEPLOY_PROJECT_MISMATCH', 'Package belongs to another project');
  const nodes = options.nodes ?? [];
  invariant(nodes.length > 0, 'DEPLOY_NODE_REQUIRED', 'Deploy requires at least one explicit --node');
  const environment = options.environment ?? 'candidate';
  invariant(['candidate', 'production'].includes(environment), 'DEPLOY_ENVIRONMENT_INVALID', 'Environment must be candidate or production');
  if (environment === 'production') {
    const expected = `${adapter.project}:${packageSet.sourceSha}`;
    invariant(options.approveProduction === expected, 'PRODUCTION_APPROVAL_REQUIRED', `Production requires --approve-production ${expected}`);
  }
  const deployments = [];
  for (const nodeKey of nodes) {
    const node = adapter.nodes[nodeKey];
    invariant(Boolean(node), 'DEPLOY_NODE_UNKNOWN', `Unknown node ${nodeKey}`);
    for (const artifact of packageSet.artifacts) {
      const deployment = node.deployments[artifact.target];
      invariant(Boolean(deployment), 'DEPLOY_TARGET_UNSUPPORTED', `${nodeKey} does not deploy ${artifact.target}`);
      if (environment === 'production') {
        invariant(deployment.productionEnabled !== false, 'DEPLOY_PRODUCTION_DISABLED', deployment.productionDisabledReason ?? `${nodeKey}/${artifact.target} requires an external A3 procedure`, { node: nodeKey, target: artifact.target });
      }
      deployments.push({ nodeKey, node, artifact, deployment });
    }
  }
  const paths = statePaths(adapter);
  const lockDirectories = [
    ...(environment === 'production' ? [join(paths.locks, 'production.lock')] : []),
    ...nodes.map((node) => join(paths.locks, 'nodes', `${node}.lock`)),
    ...deployments.map(({ nodeKey, artifact }) => join(paths.locks, 'targets', nodeKey, `${artifact.target}.lock`)),
  ];
  const release = await acquireLocks(lockDirectories, {
    project: adapter.project,
    phase: `deploy:${environment}`,
    sourceSha: packageSet.sourceSha,
    nodes,
    targets: [...new Set(deployments.map(({ artifact }) => artifact.target))].sort(),
    services: [...new Set(deployments.map(({ deployment }) => deployment.service))].sort(),
  });
  try {
    const results = [];
    for (const item of deployments) results.push(await executeDeployment(adapter, item, environment, options));
    const timings = aggregateDeployTimings(results);
    timings.package = packageSet.timings?.package ?? 0;
    timings.total = elapsed(started);
    const result = { schema: 'ai.delivery.deploy.v1', project: adapter.project, environment, sourceSha: packageSet.sourceSha, results, timings, traffic: aggregateDeployTraffic(results), completedAt: new Date().toISOString() };
    await writeJson(join(dirname(packagePath), `deploy-${environment}.json`), result);
    return result;
  } finally {
    await release();
  }
}

export async function installCommand(adapter, options) {
  const started = performance.now();
  const mode = options.mode ?? 'agent';
  invariant(['agent', 'runtime-candidate', 'verify'].includes(mode), 'INSTALL_MODE_INVALID', `Unsupported install mode: ${mode}`);
  const nodeScope = mode === 'runtime-candidate' ? required(options.node, 'INSTALL_NODE_REQUIRED') : 'all';
  invariant(nodeScope === 'all' || Boolean(adapter.nodes[nodeScope]), 'INSTALL_NODE_UNKNOWN', `Unknown install node: ${nodeScope}`);
  await assertWorktreeClean(adapter.projectRoot);
  const head = await currentHead(adapter.projectRoot);
  if (options.sourceSha) invariant(options.sourceSha === head, 'INSTALL_SOURCE_SHA_MISMATCH', 'Installation source must be the checked-out commit', { head, requested: options.sourceSha });
  await assertBuildRefIsCheckedOut(adapter.projectRoot, head);
  const expected = `${adapter.project}:install:${head}`;
  invariant(options.approveInstall === expected, 'INSTALL_APPROVAL_REQUIRED', `Install requires --approve-install ${expected}`);
  const transport = adapter.transport;
  invariant(transport?.kind === 'ssh', 'INSTALL_REQUIRES_SSH', 'Production installation requires the declared SSH transport');
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(Boolean(host), 'DEPLOY_SSH_HOST_MISSING', 'SSH host missing for production installation');
  const bundleFiles = [
    '04_tools/release-engine/remote/agent.mjs',
    '02_platform_pingtai/infrastructure/release/install-ai-delivery-agent.sh',
    '02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/ecosystem.config.cjs',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-storefront@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-identity-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-purchase-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-web-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-catalog-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-catalog-jobs@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-payment-webhook-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-payment-jobs@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-api.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-purchase-api.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-web-api.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-catalog-api.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-catalog-jobs.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-payment-webhook-api.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-payment-jobs.service',
  ];
  const paths = statePaths(adapter);
  const bundleDirectory = join(paths.root, 'bootstrap', head);
  await mkdir(bundleDirectory, { recursive: true });
  const archive = join(bundleDirectory, `install-${mode}.tar.gz`);
  const packageStarted = performance.now();
  await runCommand({ name: `install-package:${mode}`, argv: ['tar', '-czf', archive, '-C', adapter.projectRoot, ...bundleFiles], timeoutMs: 120_000 }, basicContext(adapter));
  const packageMs = elapsed(packageStarted);
  const archiveBytes = (await lstat(archive)).size;
  const archiveSha256 = await hashLocalFile(archive);
  const remoteArchive = `/tmp/ai-delivery-install-${head}-${archiveSha256}.tar.gz`;
  const remoteRoot = `/opt/ai-delivery/bootstrap/${head}-${archiveSha256}`;
  const upload = await runCommand({ name: `install-upload:${mode}`, argv: ['scp', archive, `${host}:${remoteArchive}`], timeoutMs: transport.uploadTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
  const remoteHash = await runCommand({ name: `install-hash:${mode}`, argv: ['ssh', host, 'sha256sum', remoteArchive], timeoutMs: 30_000 }, basicContext(adapter));
  invariant(remoteHash.output.trim().split(/\s+/)[0] === archiveSha256, 'INSTALL_ARCHIVE_HASH_MISMATCH', 'Remote installation archive hash differs');
  await runCommand({ name: `install-directory:${mode}`, argv: ['ssh', host, 'mkdir', '-p', remoteRoot], timeoutMs: 30_000 }, basicContext(adapter));
  await runCommand({ name: `install-extract:${mode}`, argv: ['ssh', host, 'tar', '-xzf', remoteArchive, '-C', remoteRoot], timeoutMs: 120_000 }, basicContext(adapter));
  const installed = await runCommand({ name: `install-apply:${mode}`, argv: ['ssh', host, 'flock', '-n', '/run/lock/ai-delivery-bootstrap.lock', 'bash', `${remoteRoot}/02_platform_pingtai/infrastructure/release/install-ai-delivery-agent.sh`, mode, remoteRoot, nodeScope], timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
  await runCommand({ name: `install-cleanup:${mode}`, argv: ['ssh', host, 'rm', '-f', remoteArchive], timeoutMs: 30_000 }, basicContext(adapter));
  return {
    schema: 'ai.delivery.install.v1',
    project: adapter.project,
    mode,
    node: nodeScope,
    sourceSha: head,
    archive: { path: archive, bytes: archiveBytes, sha256: `sha256:${archiveSha256}` },
    remoteRoot,
    timings: { package: packageMs, upload: upload.durationMs, install: installed.durationMs, total: elapsed(started) },
    traffic: { artifactBytes: archiveBytes, uploadedBytes: archiveBytes, reusedBytes: 0 },
    installedAt: new Date().toISOString(),
  };
}

export async function verifyCommand(adapter, options) {
  const started = performance.now();
  const nodeKey = required(options.node ?? options.nodes?.[0], 'VERIFY_NODE_REQUIRED');
  const targetId = required(options.target, 'VERIFY_TARGET_REQUIRED');
  const node = adapter.nodes[nodeKey];
  const deployment = node?.deployments?.[targetId];
  invariant(Boolean(deployment), 'VERIFY_TARGET_UNKNOWN', `Unknown deployment ${nodeKey}/${targetId}`);
  const transport = node.transport ?? adapter.transport;
  if (transport.kind === 'ssh') return remoteControlCommand(adapter, options, 'verify');
  const results = [];
  let index = 0;
  for (const command of deployment.health ?? []) {
    results.push(await runCommand(command, {
      projectRoot: adapter.projectRoot,
      environment: {},
      changedFiles: [],
      logPath: join(statePaths(adapter).root, 'verification', `${nodeKey}-${targetId}-${index++}.log`),
      node: nodeKey,
      target: targetId,
    }));
  }
  return { schema: 'ai.delivery.verify.v1', project: adapter.project, node: nodeKey, target: targetId, results, timings: { verify: elapsed(started), total: elapsed(started) }, completedAt: new Date().toISOString() };
}

export async function rollbackCommand(adapter, options) {
  return remoteControlCommand(adapter, options, 'rollback');
}

export async function seedCommand(adapter, options) {
  const nodeKey = required(options.node ?? options.nodes?.[0], 'SEED_NODE_REQUIRED');
  const targetId = required(options.target, 'SEED_TARGET_REQUIRED');
  const sourceSha = required(options.sourceSha, 'SEED_SOURCE_SHA_REQUIRED');
  invariant(/^[a-f0-9]{40}$/.test(sourceSha), 'SEED_SOURCE_SHA_INVALID', 'Seed source must be a full lowercase Git SHA');
  const expected = `${adapter.project}:seed-layout:${sourceSha}`;
  invariant(options.approveSeed === expected, 'SEED_APPROVAL_REQUIRED', `Seed requires --approve-seed ${expected}`);
  const node = adapter.nodes[nodeKey];
  const deployment = node?.deployments?.[targetId];
  invariant(Boolean(deployment), 'SEED_TARGET_UNKNOWN', `Unknown deployment ${nodeKey}/${targetId}`);
  const transport = node.transport ?? adapter.transport;
  invariant(transport.kind === 'ssh', 'SEED_REQUIRES_REMOTE_POLICY', 'Seed is a one-time server migration and requires the remote policy');
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(Boolean(host), 'DEPLOY_SSH_HOST_MISSING', `SSH host missing for ${nodeKey}`);
  const remoteAgent = transport.agent ?? '/usr/local/lib/ai-delivery/agent.mjs';
  const result = await runCommand({
    name: `seed:${nodeKey}:${targetId}`,
    argv: ['ssh', host, remoteAgent, 'seed', '--project', adapter.project, '--node', nodeKey, '--target', targetId, '--source-sha', sourceSha, '--approval', expected],
    timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
  }, basicContext(adapter));
  return { schema: 'ai.delivery.seed.v1', project: adapter.project, node: nodeKey, target: targetId, durationMs: result.durationMs, remote: parseCommandJson(result) };
}

export async function statusCommand(adapter, options) {
  if (!options.node || !options.target) {
    const paths = statePaths(adapter);
    return { schema: 'ai.delivery.status.v1', project: adapter.project, localState: paths.root, nodes: Object.keys(adapter.nodes).sort(), targets: Object.keys(adapter.targets).sort() };
  }
  return remoteControlCommand(adapter, options, 'status');
}

async function executeDeployment(adapter, item, environment, options) {
  const transport = item.node.transport ?? adapter.transport;
  invariant(transport?.kind === 'local' || transport?.kind === 'ssh', 'DEPLOY_TRANSPORT_INVALID', `Unsupported transport for ${item.nodeKey}`);
  if (options.dryRun) return { node: item.nodeKey, target: item.artifact.target, environment, dryRun: true, pointerRoot: item.deployment.pointerRoot, service: item.deployment.service };
  if (transport.kind === 'local') return localDeploy(adapter, item, environment);
  const remoteAgent = transport.agent ?? '/usr/local/lib/ai-delivery/agent.mjs';
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(Boolean(host), 'DEPLOY_SSH_HOST_MISSING', `SSH host missing for ${item.nodeKey}`);
  const incomingName = `${adapter.project}--${item.nodeKey}--${item.artifact.target}--${item.artifact.archive.sha256.slice(7)}`;
  const incoming = `${transport.incomingRoot ?? '/opt/ai-delivery/incoming'}/${incomingName}.tar.gz`;
  const incomingManifest = `${transport.incomingRoot ?? '/opt/ai-delivery/incoming'}/${incomingName}.artifact.json`;
  const identityArgs = [
    '--project', adapter.project,
    '--node', item.nodeKey,
    '--target', item.artifact.target,
    '--source-sha', item.artifact.sourceSha,
    '--sha256', item.artifact.archive.sha256.slice(7),
    '--tree-digest', item.artifact.treeDigest,
    '--manifest-digest', item.artifact.manifestDigest,
  ];
  const manifestBytes = (await lstat(item.artifact.manifestPath)).size;
  const artifactBytes = item.artifact.archive.bytes + manifestBytes;
  const lookup = await runCommand({ name: `artifact-lookup:${item.nodeKey}:${item.artifact.target}`, argv: ['ssh', host, remoteAgent, 'lookup', ...identityArgs], timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
  const lookupRemote = parseCommandJson(lookup);
  const lookupResult = lookupRemote?.result ?? {};
  let uploadDurationMs = 0;
  let uploadedBytes = 0;
  let staged;
  if (lookupResult.exists) {
    staged = await runCommand({ name: `reuse:${item.nodeKey}:${item.artifact.target}`, argv: ['ssh', host, remoteAgent, 'reuse', ...identityArgs], timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
  } else {
    const uploadArchive = await runCommand({ name: `upload-archive:${item.nodeKey}:${item.artifact.target}`, argv: ['scp', item.artifact.archive.path, `${host}:${incoming}`], timeoutMs: transport.uploadTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
    const uploadManifest = await runCommand({ name: `upload-manifest:${item.nodeKey}:${item.artifact.target}`, argv: ['scp', item.artifact.manifestPath, `${host}:${incomingManifest}`], timeoutMs: transport.uploadTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
    uploadDurationMs = uploadArchive.durationMs + uploadManifest.durationMs;
    uploadedBytes = artifactBytes;
    const stageArgv = ['ssh', host, remoteAgent, 'stage', '--project', adapter.project, '--node', item.nodeKey, '--target', item.artifact.target, '--archive', incoming, '--manifest', incomingManifest, '--sha256', item.artifact.archive.sha256.slice(7), '--tree-digest', item.artifact.treeDigest];
    staged = await runCommand({ name: `stage:${item.nodeKey}:${item.artifact.target}`, argv: stageArgv, timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
  }
  const stagedRemote = parseCommandJson(staged);
  let result = staged;
  let activated = null;
  if (environment === 'production') {
    activated = await runCommand({ name: `activate:${item.nodeKey}:${item.artifact.target}`, argv: ['ssh', host, remoteAgent, 'activate', '--project', adapter.project, '--node', item.nodeKey, '--target', item.artifact.target, '--approval', `${adapter.project}:${item.artifact.sourceSha}`, '--expected-current', lookupResult.current ?? 'none'], timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
    result = activated;
  }
  const activatedRemote = activated ? parseCommandJson(activated) : null;
  const activationTimings = activatedRemote?.result?.timings ?? {};
  return {
    node: item.nodeKey,
    target: item.artifact.target,
    environment,
    durationMs: lookup.durationMs + uploadDurationMs + staged.durationMs + (activated?.durationMs ?? 0),
    cacheStatus: lookupResult.status ?? 'miss',
    artifactBytes,
    uploadedBytes,
    reusedBytes: artifactBytes - uploadedBytes,
    uploadRateBytesPerSecond: uploadDurationMs > 0 ? Math.round(uploadedBytes / (uploadDurationMs / 1000)) : 0,
    timings: {
      artifactLookup: lookup.durationMs,
      upload: uploadDurationMs,
      candidate: staged.durationMs,
      cutover: activationTimings.cutover ?? 0,
      restart: activationTimings.restart ?? 0,
      health: activationTimings.health ?? 0,
      isolation: activationTimings.isolation ?? 0,
      remoteTotal: activated?.durationMs ?? 0,
    },
    remote: { lookup: lookupRemote, stage: stagedRemote, activate: activatedRemote, final: parseCommandJson(result) },
    pointerRoot: item.deployment.pointerRoot,
    service: item.deployment.service,
  };
}

function aggregateDeployTimings(results) {
  const totals = { artifactLookup: 0, upload: 0, candidate: 0, cutover: 0, restart: 0, health: 0, isolation: 0 };
  for (const result of results) {
    for (const key of Object.keys(totals)) totals[key] += result.timings?.[key] ?? 0;
  }
  return totals;
}

function aggregateDeployTraffic(results) {
  const totals = { artifactBytes: 0, uploadedBytes: 0, reusedBytes: 0, uploadRateBytesPerSecond: 0 };
  for (const result of results) {
    for (const key of ['artifactBytes', 'uploadedBytes', 'reusedBytes']) totals[key] += result[key] ?? 0;
  }
  const uploadMs = results.reduce((total, result) => total + (result.timings?.upload ?? 0), 0);
  totals.uploadRateBytesPerSecond = uploadMs > 0 ? Math.round(totals.uploadedBytes / (uploadMs / 1000)) : 0;
  return totals;
}

async function localDeploy(adapter, item, environment) {
  const started = performance.now();
  const root = resolve(adapter.projectRoot, adapter.transport.localRoot ?? '.ai-delivery/local-remote');
  const targetRoot = join(root, item.nodeKey, item.artifact.target);
  const releases = join(targetRoot, 'releases');
  const release = join(releases, item.artifact.treeDigest.slice(7));
  await mkdir(release, { recursive: true });
  await cp(item.artifact.archive.path, join(release, basename(item.artifact.archive.path)), { force: true });
  if (environment === 'production') await writeFile(join(targetRoot, 'current.txt'), `${release}\n`);
  else await writeFile(join(targetRoot, 'candidate.txt'), `${release}\n`);
  const total = elapsed(started);
  return {
    node: item.nodeKey,
    target: item.artifact.target,
    environment,
    release,
    service: item.deployment.service,
    durationMs: total,
    timings: { upload: 0, candidate: environment === 'candidate' ? total : 0, cutover: environment === 'production' ? total : 0, restart: 0, health: 0, isolation: 0 },
  };
}

async function remoteControlCommand(adapter, options, action) {
  const nodeKey = required(options.node ?? options.nodes?.[0], `${action.toUpperCase()}_NODE_REQUIRED`);
  const targetId = required(options.target, `${action.toUpperCase()}_TARGET_REQUIRED`);
  const node = adapter.nodes[nodeKey];
  const deployment = node?.deployments?.[targetId];
  invariant(Boolean(deployment), `${action.toUpperCase()}_TARGET_UNKNOWN`, `Unknown deployment ${nodeKey}/${targetId}`);
  const transport = node.transport ?? adapter.transport;
  if (transport.kind === 'local') {
    return { schema: `ai.delivery.${action}.v1`, project: adapter.project, node: nodeKey, target: targetId, pointerRoot: deployment.pointerRoot, transport: 'local' };
  }
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(Boolean(host), 'DEPLOY_SSH_HOST_MISSING', `SSH host missing for ${nodeKey}`);
  const remoteAgent = transport.agent ?? '/usr/local/lib/ai-delivery/agent.mjs';
  const result = await runCommand({ name: `${action}:${nodeKey}:${targetId}`, argv: ['ssh', host, remoteAgent, action, '--project', adapter.project, '--node', nodeKey, '--target', targetId, '--pointer-root', deployment.pointerRoot, '--service', deployment.service] }, basicContext(adapter));
  return { schema: `ai.delivery.${action}.v1`, project: adapter.project, node: nodeKey, target: targetId, durationMs: result.durationMs, remote: parseCommandJson(result) };
}

function commandContext(adapter, plan, runDirectory, target, logName) {
  const outputDirectory = join(runDirectory, 'command-output', target);
  return {
    projectRoot: adapter.projectRoot,
    environment: { AI_DELIVERY_OUTPUT_DIR: outputDirectory, AI_DELIVERY_TARGET: target, AI_DELIVERY_SOURCE_SHA: plan.to.sha },
    changedFiles: plan.changes.map((change) => change.path),
    logPath: join(runDirectory, 'logs', `${logName.replaceAll(/[^A-Za-z0-9_.-]/g, '_')}.log`),
    outputDirectory,
    target,
    sourceSha: plan.to.sha,
  };
}

function basicContext(adapter) {
  return { projectRoot: adapter.projectRoot, environment: {}, changedFiles: [] };
}

function requiredPath(value, code) {
  return resolve(required(value, code));
}

function required(value, code) {
  if (!value) throw new DeliveryError(code, code.replaceAll('_', ' ').toLowerCase());
  return value;
}

async function hashLocalFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function elapsed(started) {
  return Math.max(0, Math.round(performance.now() - started));
}

function parseCommandJson(command) {
  try {
    return JSON.parse(command.output);
  } catch {
    throw new DeliveryError('REMOTE_AGENT_OUTPUT_INVALID', 'Remote delivery agent did not return JSON', { outputTail: command.outputTail });
  }
}
