#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { loadAdapter, resolveDeployment } from './src/adapter.mjs';
import { buildRelease, createReleasePlan, packageRelease } from './src/build-core-1-6.mjs';
import { asDeliveryError, DeliveryError, invariant } from './src/errors.mjs';
import { simpleDownloadEndpoint, simpleOssClientFromEnvironment } from './src/oss-client-1-6.mjs';
import { runCommand } from './src/runner.mjs';
import { inspectSimpleArtifact, publishSimpleArtifacts, resolveSimpleArtifact } from './src/simple-artifact-store.mjs';

const SHA = /^[a-f0-9]{40}$/;
const RELEASE_ID = /^r16-([a-f0-9]{40})$/;
const context = { stage: 'startup', target: null, node: null };

async function main() {
  try {
    const options = parse(process.argv.slice(2));
    const controlRoot = resolve(options.controlRoot ?? process.cwd());
    const sourceSha = sourceFromIdentifier(options.identifier ?? options.sourceSha);
    const loaded = await loadAdapter(join(controlRoot, '02_platform_pingtai/infrastructure/release/zdt-next.release.json'), controlRoot);
    const adapter = Object.freeze({
      ...bindControlPlaneModules(loaded, controlRoot),
      projectRoot: options.sourceRoot ? resolve(options.sourceRoot) : controlRoot,
      stateDirectory: resolve(process.env.RUNNER_TEMP ?? '/tmp', `zdt-runner-1-6-${process.env.GITHUB_RUN_ID ?? process.pid}`),
    });
    let result;
    if (options.operation === 'release' || options.operation === 'retry') {
      invariant(sourceSha, 'SOURCE_SHA_REQUIRED', 'release and retry require a full Source SHA or r16 release id');
      result = await release(adapter, controlRoot, sourceSha);
    } else if (options.operation === 'status') {
      invariant(sourceSha, 'SOURCE_SHA_REQUIRED', 'status requires a full Source SHA or r16 release id');
      result = await status(adapter, controlRoot, sourceSha);
    } else if (options.operation === 'rollback') {
      result = await rollback(adapter, controlRoot, options.target, options.node);
    } else throw new DeliveryError('OPERATION_UNKNOWN', `Unknown Runner 1.6 operation: ${options.operation}`);
    process.stdout.write(`RUNNER_1_6_RESULT=${JSON.stringify(result)}\n`);
  } catch (unknown) {
    const error = asDeliveryError(unknown);
    const details = error.details ?? {};
    const failure = {
      state: 'FAILED',
      stage: context.stage,
      target: context.target,
      node: context.node,
      command: Array.isArray(details.argv) ? details.argv.join(' ') : null,
      exitCode: details.exitCode ?? null,
      error: error.message,
      code: error.code,
      output: details.outputTail ?? null,
      serviceStatus: nested(details, ['candidateFailure', 'details', 'readiness']) ?? nested(details, ['receipt', 'readiness']) ?? null,
      recovery: details.rollback ?? details.pointerRecovery ?? null,
    };
    process.stderr.write(`RUNNER_1_6_RESULT=${JSON.stringify(failure)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

async function release(adapter, controlRoot, sourceSha) {
  context.stage = 'dependencies';
  const install = { argv: ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], timeoutMs: 20 * 60_000 };
  await runCommand({ ...install, name: 'install-control-dependencies' }, { ...commandContext(adapter), projectRoot: controlRoot });
  if (resolve(controlRoot) !== resolve(adapter.projectRoot)) {
    await runCommand({ ...install, name: 'install-source-dependencies' }, commandContext(adapter));
  }
  context.stage = 'plan';
  const plan = await createReleasePlan(adapter, { from: `${sourceSha}^`, to: sourceSha });
  const releaseId = `r16-${sourceSha}`;
  if (!plan.deployRequired) return { state: 'HEALTHY', releaseId, sourceSha, executor: executor(), targets: [], message: 'No runtime target changed.' };
  const client = simpleOssClientFromEnvironment();
  const cache = [];
  for (const target of plan.deploymentOrder) cache.push(await inspectSimpleArtifact(adapter, { target, sourceSha }, client));
  const needsBuild = cache.some((item) => !item.exists);
  let cacheStatus = 'reused';
  if (needsBuild) {
    context.stage = 'build';
    const built = await buildRelease(adapter, plan.planPath);
    context.stage = 'package';
    const packaged = await packageRelease(adapter, built.buildPath);
    context.stage = 'upload';
    await publishSimpleArtifacts(adapter, packaged.packagePath, client);
    cacheStatus = 'built';
  }

  const deployments = [];
  for (const target of plan.deploymentOrder) {
    for (const node of physicalPlacements(adapter, target)) {
      context.stage = 'deploy';
      context.target = target;
      context.node = node;
      const deployed = await deployTarget(adapter, controlRoot, client, { target, node, sourceSha });
      deployments.push(deployed);
    }
  }
  return { state: 'HEALTHY', releaseId, sourceSha, controlSha: process.env.CONTROL_SHA, executor: executor(), cacheStatus, targets: deployments };
}

async function deployTarget(adapter, controlRoot, publicClient, { target, node, sourceSha }) {
  const resolved = await resolveSimpleArtifact(adapter, { target, sourceSha }, publicClient);
  const deployment = resolveDeployment(adapter, node, target);
  const transport = deployment.node.transport ?? adapter.transport;
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(host, 'DEPLOY_SSH_HOST_MISSING', `SSH host missing for ${node}`);
  const downloadClient = simpleOssClientFromEnvironment(simpleDownloadEndpoint(publicClient.endpoint, process.env.ALIYUN_OSS_INTERNAL_ENDPOINT));
  const agentHash = await fileHash(join(controlRoot, '04_tools/release-engine/remote/agent.mjs'));
  const policyHash = await fileHash(join(controlRoot, '02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json'));
  const artifact = resolved.release.artifact;
  const runtimeManifest = resolved.release.runtimeManifest;
  const result = await runCommand(
    {
      name: `deploy:${node}:${target}`,
      argv: [
        'ssh',
        host,
        transport.agent ?? '/usr/local/lib/ai-delivery/agent.mjs',
        'deploy-oss-direct-v2',
        '--project',
        adapter.project,
        '--node',
        deployment.executionNode,
        '--target',
        target,
        '--source-sha',
        sourceSha,
        '--sha256',
        artifact.sha256.slice(7),
        '--tree-digest',
        artifact.treeDigest,
        '--manifest-digest',
        runtimeManifest.manifestDigest,
        '--control-sha',
        requiredEnv('CONTROL_SHA'),
        '--github-run-id',
        requiredEnv('GITHUB_RUN_ID'),
        '--github-run-attempt',
        requiredEnv('GITHUB_RUN_ATTEMPT'),
        '--expected-remote-agent-sha256',
        `sha256:${agentHash}`,
        '--expected-remote-policy-sha256',
        `sha256:${policyHash}`,
      ],
      input: `${JSON.stringify({ artifactUrl: downloadClient.signGet(artifact.object), manifestUrl: downloadClient.signGet(runtimeManifest.object) })}\n`,
      timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
    },
    commandContext(adapter)
  );
  const remote = parseRemote(result.output);
  return {
    target,
    node: deployment.executionNode,
    requestedNode: node,
    current: remote.result?.activation?.current ?? null,
    previous: remote.result?.activation?.previous ?? null,
    health: remote.result?.activation?.readiness ?? null,
    recovery: remote.result?.activation?.rollback ?? null,
    durationMs: result.durationMs,
  };
}

async function status(adapter, controlRoot, sourceSha) {
  context.stage = 'plan';
  const plan = await createReleasePlan(adapter, { from: `${sourceSha}^`, to: sourceSha });
  const targets = [];
  let rolledBack = false;
  let failed = false;
  for (const target of plan.deploymentOrder) {
    for (const node of physicalPlacements(adapter, target)) {
      context.stage = 'status';
      context.target = target;
      context.node = node;
      const remote = await remoteControl(adapter, target, node, 'status');
      const currentSha = remote.result?.currentArtifact?.sourceSha ?? null;
      const previousSha = remote.result?.previousArtifact?.sourceSha ?? null;
      let health = null;
      if (currentSha === sourceSha) {
        context.stage = 'health';
        health = (await remoteControl(adapter, target, node, 'verify')).result?.readiness ?? null;
      } else if (previousSha === sourceSha) rolledBack = true;
      else failed = true;
      targets.push({ target, node, currentSourceSha: currentSha, previousSourceSha: previousSha, health });
    }
  }
  const state = failed ? 'FAILED' : rolledBack ? 'ROLLED_BACK' : 'HEALTHY';
  return { state, releaseId: `r16-${sourceSha}`, sourceSha, controlSha: process.env.CONTROL_SHA, executor: executor(), targets };
}

async function rollback(adapter, controlRoot, target, node) {
  invariant(Boolean(target) && Boolean(node), 'ROLLBACK_TARGET_REQUIRED', 'rollback requires target and physical node');
  context.stage = 'rollback';
  context.target = target;
  context.node = node;
  const remote = await remoteControl(adapter, target, node, 'rollback');
  return {
    state: 'ROLLED_BACK',
    target,
    node,
    executor: executor(),
    current: remote.result?.current ?? null,
    previous: remote.result?.previous ?? null,
    serviceStatus: remote.result?.readiness ?? null,
    durationMs: remote.result?.timings?.total ?? null,
  };
}

async function remoteControl(adapter, target, node, action) {
  const deployment = resolveDeployment(adapter, node, target);
  const transport = deployment.node.transport ?? adapter.transport;
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(host, 'DEPLOY_SSH_HOST_MISSING', `SSH host missing for ${node}`);
  const result = await runCommand(
    {
      name: `${action}:${node}:${target}`,
      argv: ['ssh', host, transport.agent ?? '/usr/local/lib/ai-delivery/agent.mjs', action, '--project', adapter.project, '--node', deployment.executionNode, '--target', target],
      timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
    },
    commandContext(adapter)
  );
  return parseRemote(result.output);
}

function physicalPlacements(adapter, target) {
  return Object.entries(adapter.nodes)
    .filter(([, node]) => node.deployments?.[target] && node.deployments[target].hostedBy === undefined)
    .map(([node]) => node)
    .sort();
}

function commandContext(adapter) {
  return { projectRoot: adapter.projectRoot, environment: {}, changedFiles: [], sourceSha: '', node: '', target: '', logPath: null };
}

function parseRemote(output) {
  try {
    return JSON.parse(output);
  } catch {
    throw new DeliveryError('REMOTE_RESULT_INVALID', 'Remote command did not return JSON', { outputTail: String(output).slice(-4000) });
  }
}

function parse(args) {
  const options = { operation: args[0] };
  for (let index = 1; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith('--') || value === undefined) throw new DeliveryError('ARGUMENT_INVALID', `Invalid argument ${name ?? ''}`);
    options[name.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  return options;
}

export function sourceFromIdentifier(value) {
  if (SHA.test(value ?? '')) return value;
  return RELEASE_ID.exec(value ?? '')?.[1] ?? null;
}

function bindControlPlaneModules(adapter, controlRoot) {
  const bindCommands = (commands = []) =>
    commands.map((command) => ({
      ...command,
      argv: command.argv.map((argument) => (argument.startsWith('04_tools/release-engine/') ? join(controlRoot, argument) : argument)),
    }));
  const targets = Object.fromEntries(
    Object.entries(adapter.targets).map(([name, target]) => [
      name,
      {
        ...target,
        tests: bindCommands(target.tests),
        typecheck: bindCommands(target.typecheck),
        build: bindCommands(target.build),
      },
    ])
  );
  const impactResolvers = Object.fromEntries(
    Object.entries(adapter.impactResolvers ?? {}).map(([name, resolver]) => [
      name,
      {
        ...resolver,
        module: resolver.module.startsWith('04_tools/release-engine/') ? join(controlRoot, resolver.module) : resolver.module,
      },
    ])
  );
  return { ...adapter, targets, impactResolvers, buildPreflight: bindCommands(adapter.buildPreflight) };
}

function executor() {
  return { class: process.env.RUNNER_CLASS ?? 'unknown', name: process.env.RUNNER_NAME ?? 'unknown' };
}
function requiredEnv(name) {
  invariant(process.env[name], 'ENVIRONMENT_VALUE_REQUIRED', `${name} is required`);
  return process.env[name];
}
async function fileHash(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}
function nested(value, path) {
  return path.reduce((item, key) => item?.[key], value);
}
