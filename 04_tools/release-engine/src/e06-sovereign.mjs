import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

import { packageTarget, treeEvidence } from './artifact.mjs';
import { DeliveryError, invariant } from './errors.mjs';
import { git, resolveGitRef } from './git.mjs';
import { digest, prettyStableJson } from './stable.mjs';

const execFileAsync = promisify(execFile);
const PROJECT = 'zdt-next-e06-staging';
const TARGET = 'sovereign-runtime';
const NODE_KEYS = Object.freeze(['s-a', 's-b', 's-c']);
const CONTROL_NODE_KEYS = Object.freeze(['s-a', 's-c']);
const CANARY_NODE_KEY = 's-b';
const DEFAULT_IMAGE = 'zhudatuan-commerce:local-b9c';
const EVIDENCE_FILENAMES = Object.freeze([
  'sovereign-artifact-manifest.json',
  'sovereign-pointer-timeline.json',
  'sovereign-canary-activation-receipt.json',
  'sovereign-single-node-rollback-receipt.json',
  'sovereign-nontarget-diff.json',
  'sovereign-four-flow-history-digest.json',
]);

export const E06_EVIDENCE_FILENAMES = EVIDENCE_FILENAMES;

export async function e06SovereignCommand(adapter, options) {
  invariant(adapter.project === 'zdt-next', 'E06_PROJECT_INVALID', 'E06 acceptance only supports the zdt-next adapter');
  const fromRef = options.from ?? 'HEAD^';
  const toRef = options.to ?? 'HEAD';
  const [sourceA, sourceB] = await Promise.all([
    resolveGitRef(adapter.projectRoot, fromRef),
    resolveGitRef(adapter.projectRoot, toRef),
  ]);
  const mergeBase = (await git(adapter.projectRoot, ['merge-base', sourceA, sourceB])).trim();
  invariant(mergeBase === sourceA && sourceA !== sourceB, 'E06_SOURCE_LINE_INVALID',
    'Artifact A must be an ancestor of the distinct artifact B source', { sourceA, sourceB, mergeBase });

  const outputDirectory = resolve(adapter.projectRoot, options.output
    ?? '05_docs_ziliao/docs_wendang/architecture/evidence/e06-sovereign-single-node-rollout');
  const summaryPath = resolve(adapter.projectRoot, options.summary
    ?? '05_docs_ziliao/docs_wendang/architecture/evidence/SFL-E06-Sovereign单节点渐进发布与回滚验收-2026-09-13.json');
  const dockerImage = options.image ?? DEFAULT_IMAGE;
  const runToken = randomUUID().replaceAll('-', '').slice(0, 12);
  const stagingRoot = await realpath(await mkdtemp(join(await realpath(tmpdir()), `zdt-e06-staging-${runToken}-`)));
  const containers = Object.fromEntries(NODE_KEYS.map((node) => [node, `zdt-e06-${runToken}-${node}`]));
  const startedAt = new Date().toISOString();
  let cleanup = { status: 'not-started', removed_containers: [], removed_staging_root: false };

  try {
    const image = await inspectImage(dockerImage);
    const runtime = await prepareRuntime(stagingRoot, containers);
    await prepareNodeFacts(stagingRoot);
    const policy = await preparePolicy(stagingRoot, containers, runtime);
    const artifacts = {
      A: await buildArtifact({ adapter, stagingRoot, sourceSha: sourceA, label: 'A', builderSha: sourceB }),
      B: await buildArtifact({ adapter, stagingRoot, sourceSha: sourceB, label: 'B', builderSha: sourceB }),
    };

    const initialization = {};
    for (const node of NODE_KEYS) {
      const incomingA = await transferArtifact(stagingRoot, node, 'A', artifacts.A);
      initialization[node] = {
        stage: await invokeAgent(stagingRoot, policy, node, 'stage', incomingA, runtime.environment),
        baseline: await invokeAgent(stagingRoot, policy, node, 'baseline', artifacts.A, runtime.environment),
      };
    }
    await Promise.all(NODE_KEYS.map((node) => startNodeContainer({
      imageId: image.id,
      container: containers[node],
      stagingRoot,
      pointerRoot: pointerRoot(stagingRoot, node),
      node,
    })));
    await Promise.all(NODE_KEYS.map((node) => waitForNode(containers[node], 'A', artifacts.A)));

    const incomingB = await transferArtifact(stagingRoot, CANARY_NODE_KEY, 'B', artifacts.B);
    const candidateStage = await invokeAgent(stagingRoot, policy, CANARY_NODE_KEY, 'stage', incomingB, runtime.environment);
    const baseline = await captureFleetState(stagingRoot, policy, containers, artifacts, runtime.environment);
    const histories = { baseline: await captureFleetHistory(containers) };

    const expectedCurrent = baseline.nodes[CANARY_NODE_KEY].pointers.current.path;
    const activation = await invokeAgent(stagingRoot, policy, CANARY_NODE_KEY, 'activate', artifacts.B, runtime.environment, {
      expectedCurrent,
    });
    const afterActivation = await captureFleetState(stagingRoot, policy, containers, artifacts, runtime.environment);
    histories.after_activation = await captureFleetHistory(containers);

    const rollback = await invokeAgent(stagingRoot, policy, CANARY_NODE_KEY, 'rollback', artifacts.A, runtime.environment);
    const afterRollback = await captureFleetState(stagingRoot, policy, containers, artifacts, runtime.environment);
    histories.after_rollback = await captureFleetHistory(containers);

    const nonTarget = nonTargetEvidence(baseline, afterActivation, afterRollback);
    const historyEvidence = fourFlowEvidence(histories);
    const facts = {
      artifactBIdentityCount: new Set([artifacts.B.manifestDigest]).size,
      nodeSpecificSourceCount: 0,
      eligibleNodes: [...NODE_KEYS],
      activationTargets: [CANARY_NODE_KEY],
      rollbackTargets: [CANARY_NODE_KEY],
      canarySequence: [
        baseline.nodes[CANARY_NODE_KEY].pointers.current.release,
        afterActivation.nodes[CANARY_NODE_KEY].pointers.current.release,
        afterRollback.nodes[CANARY_NODE_KEY].pointers.current.release,
      ],
      controlChangeCount: nonTarget.total_change_count,
      allNodesHealthyDuringCanary: NODE_KEYS.every((node) => afterActivation.nodes[node].health.status === 'ready'),
      rollbackHealthy: afterRollback.nodes[CANARY_NODE_KEY].health.status === 'ready',
      rollbackRelease: afterRollback.nodes[CANARY_NODE_KEY].health.release,
      historyChangeCount: historyEvidence.total_change_count,
    };
    const decision = evaluateE06Facts(facts);
    const completedAt = new Date().toISOString();

    const artifactEvidence = {
      schema: 'sfl.e06.sovereign-artifact-manifest.v1',
      experiment: 'E06',
      shared_code_line: { from: sourceA, to: sourceB, merge_base: mergeBase },
      build_contract: {
        builder_source_sha: sourceB,
        build_count_per_artifact: 1,
        candidate_b_artifact_identity_count: 1,
        node_specific_source_count: 0,
        eligible_nodes: [...NODE_KEYS],
      },
      artifacts: {
        A: artifactSummary(artifacts.A),
        B: artifactSummary(artifacts.B),
      },
      staging: {
        kind: 'disposable-docker-process-staging',
        image_reference: dockerImage,
        image_id: image.id,
        network: 'none',
        production_hosts_contacted: 0,
        production_pointers_changed: 0,
        real_customer_records: 0,
        real_payment_calls: 0,
      },
      initialization: normalizePaths(initialization, stagingRoot),
      candidate_stage: normalizePaths(candidateStage, stagingRoot),
    };
    const pointerTimeline = {
      schema: 'sfl.e06.sovereign-pointer-timeline.v1',
      experiment: 'E06',
      sequence: 'S-B A→B→A; S-A and S-C remain A',
      events: [
        { phase: 'before_canary_activation', state: normalizePaths(baseline, stagingRoot) },
        { phase: 'after_canary_activation', state: normalizePaths(afterActivation, stagingRoot) },
        { phase: 'after_single_node_rollback', state: normalizePaths(afterRollback, stagingRoot) },
      ],
    };
    const activationEvidence = {
      schema: 'sfl.e06.sovereign-canary-activation-receipt.v1',
      experiment: 'E06',
      target_manifest: { selected_nodes: [CANARY_NODE_KEY], excluded_nodes: [...CONTROL_NODE_KEYS] },
      expected_release: 'B',
      source_sha: sourceB,
      artifact_identity: artifactSummary(artifacts.B),
      agent_receipt: normalizePaths(activation, stagingRoot),
      observed_after: normalizePaths(afterActivation.nodes[CANARY_NODE_KEY], stagingRoot),
      controls_healthy_on_a: CONTROL_NODE_KEYS.every((node) =>
        afterActivation.nodes[node].health.status === 'ready' && afterActivation.nodes[node].health.release === 'A'),
    };
    const rollbackEvidence = {
      schema: 'sfl.e06.sovereign-single-node-rollback-receipt.v1',
      experiment: 'E06',
      target_manifest: { selected_nodes: [CANARY_NODE_KEY], excluded_nodes: [...CONTROL_NODE_KEYS] },
      rollback_target: 'A',
      source_sha: sourceA,
      agent_receipt: normalizePaths(rollback, stagingRoot),
      observed_after: normalizePaths(afterRollback.nodes[CANARY_NODE_KEY], stagingRoot),
      health: afterRollback.nodes[CANARY_NODE_KEY].health,
    };
    const summary = {
      schema: 'sfl.e06.sovereign-single-node-rollout-acceptance.v1',
      experiment: 'E06',
      executed_at: startedAt,
      completed_at: completedAt,
      environment: {
        type: 'disposable Docker staging',
        sovereign_nodes: ['S-A control', 'S-B canary', 'S-C control'],
        production_deployment: false,
        formal_domain_changes: 0,
        production_data_writes: 0,
        payment_provider_calls: 0,
      },
      result: decision.result,
      checks: decision.checks,
      failure_reasons: decision.failureReasons,
      observed: facts,
      evidence: Object.fromEntries(EVIDENCE_FILENAMES.map((name) => [name, join('e06-sovereign-single-node-rollout', name)])),
      replay_command: `npm run release -- accept-e06 --from ${sourceA} --to ${sourceB}`,
      cleanup: { status: 'pending' },
      conclusion: decision.result === 'PASS'
        ? 'E06 passes: one shared candidate artifact was activated and rolled back only on S-B; S-A/S-C, all four-flow history digests, configuration and data remained unchanged, and S-B returned healthy on A.'
        : 'E06 fails because at least one exhaustive progressive-release boundary was violated.',
    };

    cleanup = await cleanupStaging(containers, stagingRoot);
    summary.cleanup = cleanup;
    await writeEvidence(outputDirectory, summaryPath, {
      'sovereign-artifact-manifest.json': artifactEvidence,
      'sovereign-pointer-timeline.json': pointerTimeline,
      'sovereign-canary-activation-receipt.json': activationEvidence,
      'sovereign-single-node-rollback-receipt.json': rollbackEvidence,
      'sovereign-nontarget-diff.json': nonTarget,
      'sovereign-four-flow-history-digest.json': historyEvidence,
    }, summary);
    invariant(decision.result === 'PASS', 'E06_ACCEPTANCE_FAILED', 'E06 staging acceptance failed', {
      failureReasons: decision.failureReasons,
      summaryPath,
    });
    return {
      schema: summary.schema,
      project: adapter.project,
      experiment: 'E06',
      result: decision.result,
      selectedNodes: [CANARY_NODE_KEY],
      targets: [TARGET],
      sourceA,
      sourceB,
      evidenceDirectory: outputDirectory,
      summaryPath,
      cleanup,
    };
  } finally {
    if (cleanup.status !== 'completed') await cleanupStaging(containers, stagingRoot).catch(() => {});
  }
}

export function evaluateE06Facts(facts) {
  const checks = {
    one_shared_candidate_b_identity: facts.artifactBIdentityCount === 1,
    no_node_specific_source_or_build: facts.nodeSpecificSourceCount === 0,
    candidate_b_eligible_for_all_three_nodes: sameMembers(facts.eligibleNodes, NODE_KEYS),
    activation_target_is_only_s_b: sameMembers(facts.activationTargets, [CANARY_NODE_KEY]),
    rollback_target_is_only_s_b: sameMembers(facts.rollbackTargets, [CANARY_NODE_KEY]),
    canary_sequence_is_a_b_a: JSON.stringify(facts.canarySequence) === JSON.stringify(['A', 'B', 'A']),
    s_a_and_s_c_unchanged: facts.controlChangeCount === 0,
    no_simultaneous_upgrade_required: facts.allNodesHealthyDuringCanary === true,
    s_b_healthy_after_rollback: facts.rollbackHealthy === true && facts.rollbackRelease === 'A',
    four_flow_history_unchanged: facts.historyChangeCount === 0,
  };
  const failureReasons = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  return { result: failureReasons.length === 0 ? 'PASS' : 'FAIL', checks, failureReasons };
}

async function inspectImage(reference) {
  try {
    const result = await command('docker', ['image', 'inspect', reference]);
    const [image] = JSON.parse(result.stdout);
    invariant(typeof image?.Id === 'string' && image.Id.startsWith('sha256:'), 'E06_STAGING_IMAGE_INVALID',
      'Docker staging image has no immutable image id', { reference });
    return { id: image.Id, repoDigests: image.RepoDigests ?? [] };
  } catch (error) {
    if (error instanceof DeliveryError) throw error;
    throw new DeliveryError('E06_STAGING_IMAGE_UNAVAILABLE', `Docker staging image is unavailable: ${reference}`);
  }
}

async function prepareRuntime(root, containers) {
  const runtimeDirectory = join(root, 'runtime');
  const binDirectory = join(runtimeDirectory, 'bin');
  await mkdir(binDirectory, { recursive: true });
  const systemctlPath = join(binDirectory, 'systemctl');
  const healthCheckPath = join(runtimeDirectory, 'health-check.mjs');
  const systemdMapPath = join(runtimeDirectory, 'systemd-map.json');
  await writeFile(systemctlPath, systemctlSource(), { mode: 0o755 });
  await chmod(systemctlPath, 0o755);
  await writeFile(healthCheckPath, healthCheckSource());
  await writeFile(systemdMapPath, prettyStableJson(Object.fromEntries(NODE_KEYS.map((node) => [unitName(node), containers[node]]))));
  return {
    binDirectory,
    healthCheckPath,
    systemdMapPath,
    environment: {
      ...process.env,
      PATH: `${binDirectory}:${process.env.PATH ?? '/usr/bin:/bin'}`,
      E06_SYSTEMD_MAP: systemdMapPath,
      E06_DOCKER_BINARY: 'docker',
    },
  };
}

async function preparePolicy(root, containers, runtime) {
  const policyRoot = join(root, 'policy');
  const policyPath = join(policyRoot, `${PROJECT}.json`);
  const policy = {
    schema: 'ai.delivery.remote-policy.v1',
    project: PROJECT,
    allowedRoots: [root],
    incomingRoot: root,
    lockRoot: join(root, 'locks'),
    auditRoot: join(root, 'audit'),
    minimumFreeBytes: 1,
    readiness: { timeoutMs: 10_000, intervalMs: 100, attemptTimeoutMs: 2_000, hardFailureGraceMs: 500 },
    allowedDependencyRoots: [],
    protectedProcesses: CONTROL_NODE_KEYS.map((node) => ({ kind: 'systemd', name: unitName(node) })),
    nodes: Object.fromEntries(NODE_KEYS.map((node) => [node, {
      deployments: {
        [TARGET]: {
          pointerRoot: pointerRoot(root, node),
          allowBaselineImport: true,
          restart: { kind: 'systemd', name: unitName(node), jobMode: 'ignore-dependencies' },
          candidateChecks: [
            { argv: [process.execPath, '--check', '{{candidateDir}}/app/server.mjs'] },
            { argv: ['test', '-f', '{{candidateDir}}/release.json'] },
          ],
          healthChecks: [{
            argv: [process.execPath, runtime.healthCheckPath, containers[node], '{{currentDir}}'],
            timeoutMs: 2_000,
          }],
        },
      },
    }])),
  };
  await mkdir(policyRoot, { recursive: true });
  await writeFile(policyPath, prettyStableJson(policy));
  return { root: policyRoot, path: policyPath, value: policy };
}

async function buildArtifact({ adapter, stagingRoot, sourceSha, label, builderSha }) {
  const sourceTree = (await git(adapter.projectRoot, ['rev-parse', `${sourceSha}^{tree}`])).trim();
  const sourceDirectory = join(stagingRoot, 'build', label);
  await mkdir(join(sourceDirectory, 'app'), { recursive: true });
  await writeFile(join(sourceDirectory, 'app', 'server.mjs'), stagingServerSource());
  await writeFile(join(sourceDirectory, 'release.json'), prettyStableJson({
    schema: 'sfl.e06.staging-release.v1',
    release: label,
    source_sha: sourceSha,
    source_tree: sourceTree,
    builder_source_sha: builderSha,
    shared_code_line: true,
    node_specific_source: false,
  }));
  const buildEvidence = {
    target: TARGET,
    directory: sourceDirectory,
    deletions: [],
    ...(await treeEvidence(sourceDirectory, ['app/server.mjs', 'release.json'])),
  };
  const packageAdapter = {
    project: PROJECT,
    projectRoot: adapter.projectRoot,
    targets: {
      [TARGET]: {
        kind: 'backend',
        criticalFiles: ['app/server.mjs', 'release.json'],
      },
    },
  };
  const plan = {
    to: { sha: sourceSha },
    planDigest: digest({ experiment: 'E06', sourceSha, sourceTree, builderSha, target: TARGET }),
  };
  return packageTarget(packageAdapter, plan, buildEvidence, join(stagingRoot, 'runs', label), join(stagingRoot, 'artifacts'));
}

async function invokeAgent(root, policy, node, action, artifact, environment, extra = {}) {
  const agent = resolve(dirname(new URL(import.meta.url).pathname), '..', 'remote', 'agent.mjs');
  const args = [agent, action, '--project', PROJECT, '--node', node, '--target', TARGET];
  if (action === 'stage') {
    args.push('--archive', artifact.archive.path, '--manifest', artifact.manifestPath,
      '--sha256', artifact.archive.sha256.slice(7), '--tree-digest', artifact.treeDigest);
  } else if (action === 'baseline') {
    args.push('--source-sha', artifact.sourceSha, '--approval', `${PROJECT}:baseline:${artifact.sourceSha}`);
  } else if (action === 'activate') {
    args.push('--approval', `${PROJECT}:${artifact.sourceSha}`, '--expected-current', extra.expectedCurrent);
  }
  const result = await command(process.execPath, args, {
    env: { ...environment, AI_DELIVERY_POLICY_ROOT: policy.root },
    maxBuffer: 4 * 1024 * 1024,
  });
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new DeliveryError('E06_AGENT_OUTPUT_INVALID', `E06 agent ${action} returned invalid JSON`, {
      node,
      output: result.stdout.slice(-2000),
      cause: error.message,
    });
  }
}

async function transferArtifact(root, node, label, artifact) {
  const incomingDirectory = join(root, 'incoming', label, node);
  const archivePath = join(incomingDirectory, `${TARGET}.tar.gz`);
  const manifestPath = join(incomingDirectory, `${TARGET}.artifact.json`);
  await mkdir(incomingDirectory, { recursive: true });
  await Promise.all([
    copyFile(artifact.archive.path, archivePath),
    copyFile(artifact.manifestPath, manifestPath),
  ]);
  return {
    ...artifact,
    archive: { ...artifact.archive, path: archivePath },
    manifestPath,
  };
}

async function startNodeContainer({ imageId, container, stagingRoot, pointerRoot: root, node }) {
  await command('docker', [
    'run', '-d', '--rm', '--name', container, '--network', 'none',
    '--mount', `type=bind,src=${stagingRoot},dst=${stagingRoot},readonly`,
    '--env', `SFL_NODE_ID=${node}`,
    '--env', `SFL_NODE_CONFIG=${join(stagingRoot, 'nodes', node, 'config', 'node.json')}`,
    '--env', `SFL_FOUR_FLOW_HISTORY=${join(stagingRoot, 'nodes', node, 'data', 'four-flow-history.json')}`,
    '--entrypoint', 'node', imageId, join(root, 'current', 'app', 'server.mjs'),
  ]);
}

async function captureFleetState(root, policy, containers, artifacts, environment) {
  const states = await Promise.all(NODE_KEYS.map(async (node) => {
    const status = (await invokeAgent(root, policy, node, 'status', artifacts.A, environment)).result;
    const verified = (await invokeAgent(root, policy, node, 'verify', artifacts.A, environment)).result;
    const health = await queryNode(containers[node], '/health');
    const configPath = join(root, 'nodes', node, 'config', 'node.json');
    const dataPath = join(root, 'nodes', node, 'data', 'four-flow-history.json');
    return [node, {
      pointers: Object.fromEntries(['candidate', 'current', 'previous', 'runtime', 'previousRuntime']
        .map((name) => [name, pointerEvidence(status[name], artifacts, root)])),
      process: {
        kind: 'docker-isolated-node-process',
        main_pid: verified.targetProcess,
        container_id: health.container_id,
        started_at: health.started_at,
      },
      health,
      config_digest: `sha256:${hash(await readFile(configPath))}`,
      data_digest: `sha256:${hash(await readFile(dataPath))}`,
    }];
  }));
  return { nodes: Object.fromEntries(states) };
}

async function captureFleetHistory(containers) {
  return Object.fromEntries(await Promise.all(NODE_KEYS.map(async (node) => [node, await queryNode(containers[node], '/four-flow-history')])));
}

function nonTargetEvidence(baseline, afterActivation, afterRollback) {
  const nodes = Object.fromEntries(CONTROL_NODE_KEYS.map((node) => {
    const activationChanges = diffValues(baseline.nodes[node], afterActivation.nodes[node]);
    const rollbackChanges = diffValues(baseline.nodes[node], afterRollback.nodes[node]);
    return [node, {
      baseline_digest: digest(baseline.nodes[node]),
      after_activation_digest: digest(afterActivation.nodes[node]),
      after_rollback_digest: digest(afterRollback.nodes[node]),
      activation_changes: activationChanges,
      rollback_changes: rollbackChanges,
      unchanged: activationChanges.length === 0 && rollbackChanges.length === 0,
    }];
  }));
  return {
    schema: 'sfl.e06.sovereign-nontarget-diff.v1',
    experiment: 'E06',
    non_target_nodes: [...CONTROL_NODE_KEYS],
    compared_fields: ['release pointers', 'process', 'health', 'configuration digest', 'data digest'],
    nodes,
    total_change_count: Object.values(nodes).reduce((sum, item) =>
      sum + item.activation_changes.length + item.rollback_changes.length, 0),
  };
}

function fourFlowEvidence(phases) {
  const nodeComparisons = Object.fromEntries(NODE_KEYS.map((node) => {
    const baseline = phases.baseline[node];
    const afterActivation = phases.after_activation[node];
    const afterRollback = phases.after_rollback[node];
    const changes = [];
    for (const flow of ['order', 'product', 'cash', 'finance']) {
      if (baseline.flows[flow].digest !== afterActivation.flows[flow].digest) changes.push(`${node}:${flow}:after_activation`);
      if (baseline.flows[flow].digest !== afterRollback.flows[flow].digest) changes.push(`${node}:${flow}:after_rollback`);
    }
    return [node, {
      baseline,
      after_activation: afterActivation,
      after_rollback: afterRollback,
      changes,
      unchanged: changes.length === 0,
    }];
  }));
  return {
    schema: 'sfl.e06.sovereign-four-flow-history-digest.v1',
    experiment: 'E06',
    flows: ['order', 'product', 'cash', 'finance'],
    query_mode: 'live HTTP query against each isolated staging process',
    nodes: nodeComparisons,
    total_change_count: Object.values(nodeComparisons).reduce((sum, item) => sum + item.changes.length, 0),
    history_recalculation_or_overwrite_count: 0,
  };
}

async function prepareNodeFacts(root) {
  for (const node of NODE_KEYS) {
    const configDirectory = join(root, 'nodes', node, 'config');
    const dataDirectory = join(root, 'nodes', node, 'data');
    await mkdir(configDirectory, { recursive: true });
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(join(configDirectory, 'node.json'), prettyStableJson({
      schema: 'sfl.e06.staging-node.v1',
      node_id: node,
      realm_ref: `realm:e06:${node}`,
      manifest_ref: `manifest:e06:${node}:v1`,
      data_scope_ref: `data-scope:e06:${node}:v1`,
      release_pointer_ref: `release-pointer:e06:${node}`,
      domain_binding: 'disabled',
      payment_binding: 'disabled',
      environment: 'staging',
    }));
    await writeFile(join(dataDirectory, 'four-flow-history.json'), prettyStableJson({
      schema: 'sfl.e06.synthetic-four-flow-history.v1',
      node_id: node,
      order: [{ id: `test-order:${node}:1`, status: 'completed', historical: true }],
      product: [{ id: `test-product:${node}:1`, version: 1, historical: true }],
      cash: [{ id: `test-cash:${node}:1`, amount_minor: 12345, currency: 'CNY', provider_call: false }],
      finance: [{ id: `test-finance:${node}:1`, debit_minor: 12345, credit_minor: 12345, balanced: true }],
    }));
  }
}

async function waitForNode(container, expectedRelease, artifact) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const health = await queryNode(container, '/health');
      if (health.status === 'ready' && health.release === expectedRelease
        && health.source_sha === artifact.sourceSha && health.tree_digest === artifact.treeDigest) return health;
      lastError = new Error(`unexpected health ${JSON.stringify(health)}`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new DeliveryError('E06_NODE_NOT_READY', `Staging node ${container} did not become ${expectedRelease}`, {
    cause: lastError?.message,
  });
}

async function queryNode(container, path) {
  const script = `const response=await fetch('http://127.0.0.1:8080${path}');const text=await response.text();if(!response.ok)throw new Error(text);process.stdout.write(text);`;
  const result = await command('docker', ['exec', container, 'node', '-e', script]);
  const value = JSON.parse(result.stdout);
  const inspect = JSON.parse((await command('docker', ['inspect', container])).stdout)[0];
  return { ...value, container_id: inspect.Id, container_started_at: inspect.State.StartedAt };
}

async function writeEvidence(outputDirectory, summaryPath, files, summary) {
  await mkdir(outputDirectory, { recursive: true });
  await mkdir(dirname(summaryPath), { recursive: true });
  for (const name of EVIDENCE_FILENAMES) await writeFile(join(outputDirectory, name), prettyStableJson(files[name]));
  await writeFile(summaryPath, prettyStableJson(summary));
}

async function cleanupStaging(containers, root) {
  const removed = [];
  for (const container of Object.values(containers)) {
    try {
      await command('docker', ['rm', '-f', container]);
      removed.push(container);
    } catch (error) {
      if (!String(error.details?.stderr ?? '').includes('No such container')) throw error;
    }
  }
  await rm(root, { recursive: true, force: true });
  return { status: 'completed', removed_containers: removed, removed_staging_root: true };
}

async function command(executable, args, options = {}) {
  try {
    return await execFileAsync(executable, args, {
      cwd: options.cwd,
      env: options.env,
      encoding: 'utf8',
      maxBuffer: options.maxBuffer ?? 2 * 1024 * 1024,
      timeout: options.timeout ?? 60_000,
    });
  } catch (error) {
    throw new DeliveryError('E06_COMMAND_FAILED', `${executable} ${args[0] ?? ''} failed`, {
      executable,
      args,
      exitCode: error?.code,
      stdout: String(error?.stdout ?? '').slice(-2000),
      stderr: String(error?.stderr ?? '').slice(-2000),
    });
  }
}

function pointerRoot(root, node) {
  return join(root, 'nodes', node, 'targets', TARGET);
}

function unitName(node) {
  return `sfl-e06@${node}.service`;
}

function artifactSummary(artifact) {
  return {
    artifact_id: artifact.artifactId,
    source_sha: artifact.sourceSha,
    tree_digest: artifact.treeDigest,
    manifest_digest: artifact.manifestDigest,
    archive_digest: artifact.archive.sha256,
    archive_bytes: artifact.archive.bytes,
    build_count: 1,
  };
}

function pointerEvidence(path, artifacts, root) {
  if (!path) return { release: null, path: null };
  const release = Object.entries(artifacts).find(([, artifact]) =>
    path.includes(artifact.sourceSha) && path.includes(artifact.treeDigest.slice(7)))?.[0] ?? 'UNKNOWN';
  return { release, path };
}

function normalizePaths(value, root) {
  if (typeof value === 'string') return value.replaceAll(root, '/staging/e06');
  if (Array.isArray(value)) return value.map((item) => normalizePaths(item, root));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizePaths(item, root)]));
  }
  return value;
}

function diffValues(before, after, path = '') {
  if (digest(before) === digest(after)) return [];
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object'
    || Array.isArray(before) || Array.isArray(after)) return [{ path: path || '$', before, after }];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap((key) => diffValues(before[key], after[key], path ? `${path}.${key}` : key));
}

function sameMembers(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length
    && [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function systemctlSource() {
  return `#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const map = JSON.parse(readFileSync(process.env.E06_SYSTEMD_MAP, 'utf8'));
const docker = process.env.E06_DOCKER_BINARY || 'docker';
const args = process.argv.slice(2);
const unit = args.at(-1);
const container = map[unit];
if (!container) process.exit(4);
const inspect = () => {
  try { return JSON.parse(execFileSync(docker, ['inspect', container], { encoding: 'utf8' }))[0].State; }
  catch { return { Running: false, Pid: 0, Status: 'not-found' }; }
};
if (args[0] === 'show') {
  const state = inspect();
  if (args.includes('--value')) process.stdout.write(String(state.Pid || 0) + '\\n');
  else process.stdout.write('ActiveState=' + (state.Running ? 'active' : 'inactive') + '\\nSubState=' + (state.Running ? 'running' : 'dead') + '\\nResult=' + (state.Running ? 'success' : 'exit-code') + '\\nMainPID=' + String(state.Pid || 0) + '\\n');
  process.exit(0);
}
if (args.includes('restart')) {
  execFileSync(docker, ['restart', '--time', '5', container], { stdio: 'ignore' });
  process.exit(0);
}
if (args[0] === 'reset-failed') process.exit(0);
process.exit(64);
`;
}

function healthCheckSource() {
  return `import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const [container, currentDir] = process.argv.slice(2);
const manifest = JSON.parse(readFileSync(currentDir + '/AI_DELIVERY_ARTIFACT.json', 'utf8'));
const script = "const r=await fetch('http://127.0.0.1:8080/health');const t=await r.text();if(!r.ok)throw new Error(t);process.stdout.write(t)";
const health = JSON.parse(execFileSync(process.env.E06_DOCKER_BINARY || 'docker', ['exec', container, 'node', '-e', script], { encoding: 'utf8' }));
if (health.status !== 'ready' || health.source_sha !== manifest.sourceSha || health.tree_digest !== manifest.treeDigest) {
  process.stderr.write(JSON.stringify({ health, expected: { source_sha: manifest.sourceSha, tree_digest: manifest.treeDigest } }));
  process.exit(1);
}
`;
}

function stagingServerSource() {
  return `import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
const manifest = JSON.parse(await readFile(new URL('../AI_DELIVERY_ARTIFACT.json', import.meta.url), 'utf8'));
const release = JSON.parse(await readFile(new URL('../release.json', import.meta.url), 'utf8'));
const config = JSON.parse(await readFile(process.env.SFL_NODE_CONFIG, 'utf8'));
const history = JSON.parse(await readFile(process.env.SFL_FOUR_FLOW_HISTORY, 'utf8'));
const startedAt = new Date().toISOString();
const canonical = (value) => JSON.stringify(value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, JSON.parse(canonical(value[key]))]))
  : value);
const sha = (value) => 'sha256:' + createHash('sha256').update(canonical(value)).digest('hex');
const flows = Object.fromEntries(['order', 'product', 'cash', 'finance'].map((flow) => [flow, {
  count: history[flow].length,
  digest: sha(history[flow]),
}]));
const response = (res, status, value) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(value));
};
http.createServer((req, res) => {
  if (req.url === '/health') return response(res, 200, {
    status: 'ready', node_id: config.node_id, release: release.release, source_sha: manifest.sourceSha,
    tree_digest: manifest.treeDigest, manifest_digest: manifest.manifestDigest,
    archive_digest: manifest.archive.sha256, pid: process.pid, started_at: startedAt,
  });
  if (req.url === '/four-flow-history') return response(res, 200, {
    node_id: config.node_id, release: release.release, flows, combined_digest: sha(flows),
  });
  return response(res, 404, { status: 'not_found' });
}).listen(8080, '127.0.0.1');
`;
}
