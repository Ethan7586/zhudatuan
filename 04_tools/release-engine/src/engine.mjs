import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { cp, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import { materializeTarget, packageTarget, resolvePackageArtifactPaths } from './artifact.mjs';
import { resolveDeployment } from './adapter.mjs';
import { DeliveryError, invariant } from './errors.mjs';
import { assertBuildRefIsCheckedOut, assertWorktreeClean, currentHead } from './git.mjs';
import { layerCommand } from './layer.mjs';
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
  const packageSet = await resolvePackageArtifactPaths(packagePath, await readJson(packagePath));
  invariant(packageSet.project === adapter.project, 'DEPLOY_PROJECT_MISMATCH', 'Package belongs to another project');
  const nodes = options.nodes ?? [];
  invariant(nodes.length > 0, 'DEPLOY_NODE_REQUIRED', 'Deploy requires at least one explicit --node');
  const environment = options.environment ?? 'candidate';
  invariant(['candidate', 'production'].includes(environment), 'DEPLOY_ENVIRONMENT_INVALID', 'Environment must be candidate or production');
  if (environment === 'production') {
    const expected = `${adapter.project}:${packageSet.sourceSha}`;
    invariant(options.approveProduction === expected, 'PRODUCTION_APPROVAL_REQUIRED', `Production requires --approve-production ${expected}`);
  }
  const deployments = new Map();
  const skipped = [];
  for (const requestedNode of nodes) {
    invariant(Boolean(adapter.nodes[requestedNode]), 'DEPLOY_NODE_UNKNOWN', `Unknown node ${requestedNode}`);
    for (const artifact of packageSet.artifacts) {
      const resolved = resolveDeployment(adapter, requestedNode, artifact.target);
      const { executionNode: nodeKey, node, deployment } = resolved;
      if (environment === 'production' && deployment.productionEnabled === false) {
        skipped.push({
          ok: true,
          skipped: true,
          status: 'not-applicable',
          node: nodeKey,
          requestedNode,
          target: artifact.target,
          environment,
          reason: deployment.productionDisabledReason ?? `${nodeKey}/${artifact.target} is not a production target`,
        });
        continue;
      }
      const key = `${nodeKey}:${artifact.target}`;
      const existing = deployments.get(key);
      if (existing) {
        existing.requestedNodes.push(requestedNode);
      } else {
        deployments.set(key, { nodeKey, node, artifact, deployment, requestedNodes: [requestedNode] });
      }
    }
  }
  invariant(deployments.size > 0, 'DEPLOY_NO_ENABLED_TARGETS', 'The selected package has no enabled target for the requested production node(s)', { nodes });
  const paths = statePaths(adapter);
  const results = [...skipped];
  for (const item of deployments.values()) {
    const release = await acquireLocks([
      join(paths.locks, 'nodes', `${item.nodeKey}.lock`),
      join(paths.locks, 'targets', item.nodeKey, `${item.artifact.target}.lock`),
    ], {
      project: adapter.project,
      phase: `deploy:${environment}`,
      sourceSha: packageSet.sourceSha,
      node: item.nodeKey,
      target: item.artifact.target,
      service: item.deployment.service,
    });
    try {
      results.push({ ok: true, ...(await executeDeployment(adapter, item, environment, options)) });
    } catch (error) {
      results.push({ ok: false, node: item.nodeKey, target: item.artifact.target, environment, error: { code: error.code ?? 'DEPLOYMENT_FAILED', message: error.message, details: error.details ?? {} } });
    } finally {
      await release();
    }
  }
  const successful = results.filter((item) => item.ok && !item.skipped);
  const timings = aggregateDeployTimings(successful);
  timings.package = packageSet.timings?.package ?? 0;
  timings.total = elapsed(started);
  const result = { schema: 'ai.delivery.deploy.v1', project: adapter.project, environment, sourceSha: packageSet.sourceSha, finalStatus: results.every((item) => item.ok) ? 'success' : successful.length > 0 ? 'partial-failure' : 'failure', results, timings, traffic: aggregateDeployTraffic(successful), completedAt: new Date().toISOString() };
  await writeJson(join(dirname(packagePath), `deploy-${environment}.json`), result);
  invariant(result.finalStatus === 'success', 'DEPLOYMENT_OBJECTS_FAILED', 'One or more independently locked deployment objects failed', result);
  return result;
}

export async function installCommand(adapter, options) {
  const started = performance.now();
  const mode = options.mode ?? 'agent';
  invariant(['agent-candidate', 'agent', 'runtime-candidate', 'verify'].includes(mode), 'INSTALL_MODE_INVALID', `Unsupported install mode: ${mode}`);
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
    '02_platform_pingtai/config/node-runtime/hbbtzn-l1/api-gateway.Caddyfile',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/ecosystem.config.cjs',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-api-gateway@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-storefront@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-identity-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-identity-notification-jobs@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-mall-provisioning-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-purchase-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-web-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-catalog-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-catalog-jobs@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-payment-webhook-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-payment-jobs@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-console-support.service',
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
  const installed = await runCommand({ name: `install-apply:${mode}`, argv: ['ssh', host, 'flock', '-n', `/run/lock/ai-delivery/${adapter.project}-bootstrap.lock`, 'bash', `${remoteRoot}/02_platform_pingtai/infrastructure/release/install-ai-delivery-agent.sh`, mode, remoteRoot, nodeScope], timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
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

export async function baselineCommand(adapter, options) {
  const nodeKey = required(options.node ?? options.nodes?.[0], 'BASELINE_NODE_REQUIRED');
  const targetId = required(options.target, 'BASELINE_TARGET_REQUIRED');
  const sourceSha = required(options.sourceSha, 'BASELINE_SOURCE_SHA_REQUIRED');
  invariant(/^[a-f0-9]{40}$/.test(sourceSha), 'BASELINE_SOURCE_SHA_INVALID', 'Baseline source must be a full lowercase Git SHA');
  const expected = `${adapter.project}:baseline:${sourceSha}`;
  invariant(options.approveBaseline === expected, 'BASELINE_APPROVAL_REQUIRED', `Baseline import requires --approve-baseline ${expected}`);
  const node = adapter.nodes[nodeKey];
  const deployment = node?.deployments?.[targetId];
  invariant(Boolean(deployment), 'BASELINE_TARGET_UNKNOWN', `Unknown deployment ${nodeKey}/${targetId}`);
  const transport = node.transport ?? adapter.transport;
  invariant(transport.kind === 'ssh', 'BASELINE_REQUIRES_REMOTE_POLICY', 'Baseline import requires the remote policy');
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(Boolean(host), 'DEPLOY_SSH_HOST_MISSING', `SSH host missing for ${nodeKey}`);
  const remoteAgent = transport.agent ?? '/usr/local/lib/ai-delivery/agent.mjs';
  const result = await runCommand({
    name: `baseline:${nodeKey}:${targetId}`,
    argv: ['ssh', host, remoteAgent, 'baseline', '--project', adapter.project, '--node', nodeKey, '--target', targetId, '--source-sha', sourceSha, '--approval', expected],
    timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
  }, basicContext(adapter));
  return { schema: 'ai.delivery.baseline.v1', project: adapter.project, node: nodeKey, target: targetId, durationMs: result.durationMs, remote: parseCommandJson(result) };
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
  const dependencyLayer = await ensureRemoteDependencyLayer(adapter, item, transport, host, remoteAgent);
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
  let preflight = null;
  let externalBefore = null;
  let externalAfter = null;
  if (environment === 'production') {
    const preflightCommand = await runCommand({ name: `preflight:${item.nodeKey}:${item.artifact.target}`, argv: ['ssh', host, remoteAgent, 'preflight', '--project', adapter.project, '--node', item.nodeKey, '--target', item.artifact.target], timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
    preflight = parseCommandJson(preflightCommand);
    externalBefore = await externalDomainSnapshot(adapter);
    const activateArgv = ['ssh', host, remoteAgent, 'activate', '--project', adapter.project, '--node', item.nodeKey, '--target', item.artifact.target, '--approval', `${adapter.project}:${item.artifact.sourceSha}`, '--expected-current', preflight.result.rollbackPoint.pointers.current ?? 'none'];
    if (preflight.result.caddySemantic?.digest) activateArgv.push('--expected-caddy-semantic', preflight.result.caddySemantic.digest);
    activated = await runCommand({ name: `activate:${item.nodeKey}:${item.artifact.target}`, argv: activateArgv, timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
    result = activated;
    externalAfter = await externalDomainSnapshot(adapter);
    const domainDifferences = compareDomainSnapshots(externalBefore, externalAfter);
    if (domainDifferences.length > 0) {
      const rolledBack = await runCommand({ name: `external-acceptance-rollback:${item.nodeKey}:${item.artifact.target}`, argv: ['ssh', host, remoteAgent, 'rollback', '--project', adapter.project, '--node', item.nodeKey, '--target', item.artifact.target], timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
      const afterRollback = await externalDomainSnapshot(adapter);
      const rollbackDifferences = compareDomainSnapshots(externalBefore, afterRollback);
      throw new DeliveryError('EXTERNAL_ACCEPTANCE_CHANGED', 'External domain baseline changed; target was rolled back', { domainDifferences, rollbackDifferences, before: externalBefore, after: externalAfter, afterRollback, rollback: parseCommandJson(rolledBack), activation: parseCommandJson(activated) });
    }
  }
  const activatedRemote = activated ? parseCommandJson(activated) : null;
  const activationTimings = activatedRemote?.result?.timings ?? {};
  return {
    node: item.nodeKey,
    target: item.artifact.target,
    environment,
    durationMs: dependencyLayer.durationMs + lookup.durationMs + uploadDurationMs + staged.durationMs + (activated?.durationMs ?? 0),
    cacheStatus: lookupResult.status ?? 'miss',
    artifactBytes,
    uploadedBytes: uploadedBytes + dependencyLayer.uploadedBytes,
    reusedBytes: artifactBytes - uploadedBytes + dependencyLayer.reusedBytes,
    uploadRateBytesPerSecond: uploadDurationMs > 0 ? Math.round(uploadedBytes / (uploadDurationMs / 1000)) : 0,
    timings: {
      artifactLookup: lookup.durationMs,
      dependencyLayer: dependencyLayer.durationMs,
      upload: uploadDurationMs,
      candidate: staged.durationMs,
      cutover: activationTimings.cutover ?? 0,
      restart: activationTimings.restart ?? 0,
      health: activationTimings.health ?? 0,
      isolation: activationTimings.isolation ?? 0,
      remoteTotal: activated?.durationMs ?? 0,
    },
    receipt: activatedRemote?.result?.receipt ? { ...activatedRemote.result.receipt, externalAcceptance: { status: 'passed', count: externalAfter.length, before: externalBefore, after: externalAfter, differences: [] } } : null,
    remote: { lookup: lookupRemote, stage: stagedRemote, preflight, activate: activatedRemote, final: parseCommandJson(result) },
    pointerRoot: item.deployment.pointerRoot,
    service: item.deployment.service,
  };
}

async function ensureRemoteDependencyLayer(adapter, item, transport, host, remoteAgent) {
  const layer = item.artifact.dependencyLayer;
  if (!layer) return { durationMs: 0, uploadedBytes: 0, reusedBytes: 0 };
  const started = performance.now();
  const identityArgs = [
    '--digest', layer.digest,
    '--runtime', layer.runtime,
    '--production-root', layer.productionRoot,
  ];
  const lookup = await runCommand({
    name: `layer-lookup:${item.nodeKey}:${item.artifact.target}`,
    argv: ['ssh', host, remoteAgent, 'layer-lookup', '--project', adapter.project, '--node', item.nodeKey, '--target', item.artifact.target, ...identityArgs],
    timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
  }, basicContext(adapter));
  if (parseCommandJson(lookup)?.result?.exists) {
    return { durationMs: elapsed(started), uploadedBytes: 0, reusedBytes: parseCommandJson(lookup).result.bytes ?? 0 };
  }

  const localRoot = join(statePaths(adapter).root, 'dependency-layers');
  const prepared = await layerCommand(adapter, {
    target: item.artifact.target,
    destination: localRoot,
    sourceNodeModules: join(adapter.projectRoot, 'node_modules'),
  });
  invariant(prepared.digest === layer.digest, 'DEPENDENCY_LAYER_LOCAL_MISMATCH', 'Prepared dependency layer differs from artifact declaration');
  const archive = join(localRoot, `${layer.digest.slice(7)}.tar.gz`);
  await runCommand({
    name: `layer-package:${item.nodeKey}:${item.artifact.target}`,
    argv: ['tar', '-czf', archive, '-C', prepared.destination, '.'],
    timeoutMs: 20 * 60_000,
  }, basicContext(adapter));
  const archiveStats = await lstat(archive);
  const archiveHash = await hashLocalFile(archive);
  const incoming = `${transport.incomingRoot ?? '/opt/ai-delivery/incoming'}/${adapter.project}--layer--${layer.digest.slice(7)}.tar.gz`;
  await runCommand({
    name: `layer-upload:${item.nodeKey}:${item.artifact.target}`,
    argv: ['scp', archive, `${host}:${incoming}`],
    timeoutMs: transport.uploadTimeoutMs ?? 10 * 60_000,
  }, basicContext(adapter));
  await runCommand({
    name: `layer-stage:${item.nodeKey}:${item.artifact.target}`,
    argv: ['ssh', host, remoteAgent, 'stage-layer', '--project', adapter.project, '--node', item.nodeKey, '--target', item.artifact.target, '--archive', incoming, '--sha256', archiveHash, ...identityArgs],
    timeoutMs: transport.deployTimeoutMs ?? 20 * 60_000,
  }, basicContext(adapter));
  return { durationMs: elapsed(started), uploadedBytes: archiveStats.size, reusedBytes: 0 };
}

async function externalDomainSnapshot(adapter) {
  const domains = adapter.productionAcceptance?.domains ?? [];
  invariant(domains.length === 15 && new Set(domains).size === 15, 'PRODUCTION_DOMAIN_BASELINE_INVALID', 'Production acceptance requires exactly 15 unique domains');
  const observations = await Promise.all(domains.map(async (host) => {
    try {
      const response = await fetch(`https://${host}/`, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(adapter.productionAcceptance?.timeoutMs ?? 12_000) });
      return { host, status: response.status, statusText: response.statusText || '' };
    } catch (error) {
      return { host, status: null, statusText: 'NO_HTTP_STATUS', error: error?.cause?.code ?? error?.name ?? 'FETCH_FAILED' };
    }
  }));
  return observations.sort((left, right) => left.host.localeCompare(right.host));
}

function compareDomainSnapshots(before, after) {
  const prior = new Map(before.map((item) => [item.host, `${item.status ?? ''}:${item.statusText}`]));
  return after.filter((item) => prior.get(item.host) !== `${item.status ?? ''}:${item.statusText}`).map((item) => ({ host: item.host, before: prior.get(item.host), after: `${item.status ?? ''}:${item.statusText}` }));
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
