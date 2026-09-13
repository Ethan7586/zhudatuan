#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { platform, release, tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { repositoryRoot } from '../lib/RepositoryRoot.mjs';
import { finalizeE10Evidence } from './e10-release.formal.mjs';

const markerRepositoryPath = '04_tools/scripts/audit/e10-shared-marker.txt';
const criteriaPath = join(repositoryRoot, '05_docs_ziliao', 'docs_wendang', 'architecture', 'evidence', 'e2.0', 'E2.0-E10-正式重测判据-2026-09-14.json');
const rawArtifactNames = Object.freeze([
  'shared-change.patch-id.txt',
  'single-build-provenance.json',
  'immutable-artifact-manifest.json',
  'node-pointer-timeline.json',
  'identity-feature-matrix.expected.json',
  'identity-feature-matrix.observed.json',
  'single-node-rollback-and-isolation.json',
  'environment.json',
]);
const logicalNodes = Object.freeze(['H-A', 'H-B', 'H-C', 'S-A', 'S-B', 'S-C']);
const surfaces = Object.freeze(['page', 'api', 'task', 'service']);
const deployments = Object.freeze({
  hosted: Object.freeze({ nodes: Object.freeze(['H-A', 'H-B', 'H-C']), kind: 'hosted-host' }),
  's-a': Object.freeze({ nodes: Object.freeze(['S-A']), kind: 'sovereign-node' }),
  's-b': Object.freeze({ nodes: Object.freeze(['S-B']), kind: 'sovereign-node' }),
  's-c': Object.freeze({ nodes: Object.freeze(['S-C']), kind: 'sovereign-node' }),
});
const evidenceArgument = option('--evidence-directory');
const formalExecution = evidenceArgument !== undefined;
const startedAt = new Date().toISOString();
const criteria = await readJson(criteriaPath);
if (Date.parse(criteria.locked_at) >= Date.parse(startedAt)) throw new Error('E10_CRITERIA_NOT_LOCKED_BEFORE_EXECUTION');
await verifyCriteriaSources(criteria);
const sourceControl = await sourceControlState();
const sourcePair = await resolveSourcePair();
await verifySourcePair(criteria, sourcePair);
if (formalExecution && sourceControl.tree_state !== 'CLEAN') throw new Error('E10_EVIDENCE_REQUIRES_CLEAN_TREE');
if (formalExecution && sourceControl.sha !== sourcePair.to_sha) throw new Error('E10_EVIDENCE_REQUIRES_TO_SHA_AT_HEAD');

const evidenceDirectory = formalExecution
  ? resolve(repositoryRoot, evidenceArgument)
  : await mkdtemp(join(tmpdir(), 'zhudatuan-e10-evidence-'));
if (formalExecution) {
  assertRepositoryEvidencePath(evidenceDirectory);
  await mkdir(evidenceDirectory);
}
const runToken = randomUUID().replaceAll('-', '').slice(0, 12);
const workingDirectory = await mkdtemp(join(tmpdir(), `zhudatuan-e10-work-${runToken}-`));
const containerNames = Object.fromEntries(Object.keys(deployments).map((key) => [key, `zhudatuan-e10-${runToken}-${key}`]));
const startedContainers = [];
let completed = false;

try {
  const policy = createProbePolicy(criteria);
  const policyPath = join(workingDirectory, 'policies', 'node-policies.json');
  await mkdir(dirname(policyPath), { recursive: true });
  await writeJson(policyPath, policy);

  const docker = await dockerEnvironment(criteria.execution_environment.docker_image);
  const artifactsRoot = join(workingDirectory, 'artifacts');
  const candidateRoot = join(artifactsRoot, 'B');
  const baselineRoot = join(artifactsRoot, 'A');
  const buildStartedAt = new Date().toISOString();
  const buildCommand = ['04_tools/scripts/audit/e10-shared-build.mjs', candidateRoot, sourcePair.to_sha];
  const buildResult = await execute('node', buildCommand, { cwd: repositoryRoot });
  const buildCompletedAt = new Date().toISOString();
  await cp(candidateRoot, baselineRoot, { recursive: true, force: false });
  await writeFile(join(baselineRoot, 'shared-marker.txt'), `${criteria.shared_change.marker_a}\n`);
  const baselineRelease = Object.freeze({
    schema_version: 'e10-release-version-v1',
    release: 'A',
    source_sha: sourcePair.from_sha,
    build_id: `e10:preexisting-baseline:${sourcePair.from_sha}`,
    built_at: criteria.shared_change.baseline_fixture_built_at,
  });
  await writeFile(join(baselineRoot, 'release-version.json'), `${JSON.stringify(baselineRelease)}\n`);
  await writeFile(join(baselineRoot, 'runtime', 'release-version.json'), `${JSON.stringify({
    target: 'identity-api',
    sourceSha: sourcePair.from_sha,
    builtAt: criteria.shared_change.baseline_fixture_built_at,
  })}\n`);

  const [candidateArtifact, baselineArtifact] = await Promise.all([
    artifactInventory(candidateRoot, 'B', 'candidate-single-build'),
    artifactInventory(baselineRoot, 'A', 'preexisting-baseline-fixture'),
  ]);
  const artifactManifest = createArtifactManifest(criteria, sourcePair, candidateArtifact, baselineArtifact);
  const buildProvenance = Object.freeze({
    schema_version: 'e10-single-build-provenance-v1',
    experiment: 'E10',
    source_sha: sourcePair.to_sha,
    build_invocations: [Object.freeze({
      invocation_id: `e10-build-${runToken}`,
      scope: 'shared-kernel-candidate',
      assigned_node_id: null,
      command: 'node 04_tools/scripts/audit/e10-shared-build.mjs <temporary-artifact-B-directory> <source-B-sha>',
      source_sha: sourcePair.to_sha,
      started_at: buildStartedAt,
      completed_at: buildCompletedAt,
      exit_code: buildResult.exitCode,
      stdout: buildResult.stdout.trim().split('\n').filter(Boolean),
      stderr: buildResult.stderr.trim().split('\n').filter(Boolean),
      artifact_identity: candidateArtifact.artifact_identity,
    })],
    node_specific_builds: [],
    candidate_artifact_assignments: logicalNodes
      .filter((node) => node !== 'S-C')
      .map((node) => Object.freeze({ node_id: node, release: 'B', artifact_identity: candidateArtifact.artifact_identity })),
    baseline_fixture: Object.freeze({
      build_count_during_execution: 0,
      source_sha: sourcePair.from_sha,
      artifact_identity: baselineArtifact.artifact_identity,
      derivation: 'Copied from the byte-identical candidate runtime after the source diff proved that only the external shared marker changed; release and marker metadata were restored to source A values.',
      runtime_bundle_sha256: fileEntry(baselineArtifact, 'probe/server.mjs').sha256,
    }),
  });

  await prepareDeploymentPointers(workingDirectory);
  for (const [deployment, descriptor] of Object.entries(deployments)) {
    await startContainer({
      imageId: docker.image_id,
      container: containerNames[deployment],
      workingDirectory,
      policyPath,
      deployment,
      allowedNodes: descriptor.nodes,
    });
    startedContainers.push(containerNames[deployment]);
  }
  await waitForFleet('A');

  const actions = [];
  const snapshots = [];
  snapshots.push(await captureFleetState('baseline_all_a'));
  actions.push(await switchDeployment('hosted', 'A', 'B', 'host-switch', 1));
  snapshots.push(await captureFleetState('hosted_after_single_host_switch'));
  await delay(10);
  actions.push(await switchDeployment('s-a', 'A', 'B', 'activation', 2));
  snapshots.push(await captureFleetState('sovereign_a_after_first_activation'));
  await delay(10);
  actions.push(await switchDeployment('s-b', 'A', 'B', 'activation', 3));
  const staggeredSnapshot = await captureFleetState('sovereign_b_after_later_activation');
  snapshots.push(staggeredSnapshot);
  const expectedBeforeRollback = expectedFeatureMatrix(criteria, staggeredSnapshot, 'after_staggered_activation');
  const observedBeforeRollback = await observedFeatureMatrix(criteria, 'after_staggered_activation');

  await delay(10);
  actions.push(await switchDeployment('s-b', 'B', 'A', 'rollback', 4));
  const rollbackSnapshot = await captureFleetState('after_s_b_single_node_rollback');
  snapshots.push(rollbackSnapshot);
  const expectedAfterRollback = expectedFeatureMatrix(criteria, rollbackSnapshot, 'after_s_b_rollback');
  const observedAfterRollback = await observedFeatureMatrix(criteria, 'after_s_b_rollback');

  const expectedMatrix = Object.freeze({
    schema_version: 'e10-identity-feature-matrix-expected-v1',
    experiment: 'E10',
    source_pair: sourcePair,
    model: policy,
    surfaces,
    cells: Object.freeze([...expectedBeforeRollback, ...expectedAfterRollback]),
  });
  const observedMatrix = Object.freeze({
    schema_version: 'e10-identity-feature-matrix-observed-v1',
    experiment: 'E10',
    probe_engine: 'Bundled production AccessPipeline and NodeOperationAvailabilityResolver behind four distinct read-only HTTP probe routes.',
    cells: Object.freeze([...observedBeforeRollback, ...observedAfterRollback]),
  });
  const pointerTimeline = Object.freeze({
    schema_version: 'e10-node-pointer-timeline-v1',
    experiment: 'E10',
    logical_nodes: logicalNodes,
    physical_deployments: Object.entries(deployments).map(([deployment, descriptor]) => Object.freeze({
      deployment,
      kind: descriptor.kind,
      logical_nodes: descriptor.nodes,
      container: containerNames[deployment],
    })),
    actions: Object.freeze(actions),
    snapshots: Object.freeze(snapshots),
  });
  const rollbackEvidence = createRollbackEvidence(
    staggeredSnapshot,
    rollbackSnapshot,
    observedBeforeRollback,
    observedAfterRollback,
    actions.at(-1),
  );
  const patchEvidence = await createPatchEvidence(criteria, sourcePair);
  const completedAt = new Date().toISOString();
  const environment = Object.freeze({
    schema_version: 'e10-environment-v1',
    captured_at: completedAt,
    kind: 'DEV',
    environment_id: `local-disposable-docker-e10-${runToken}`,
    description: 'Four disposable network-isolated Node.js containers represented one shared Hosted host and three independently switched Sovereign runtimes.',
    owner: 'Ethan-controlled local Codex workspace',
    isolation: `Docker --network none; read-only bind mount; synthetic node policies; containers ${startedContainers.join(', ')} removed after observation.`,
    real_customer_data: false,
    production_impact: 'None. No production host, staging host, DNS provider, database, payment provider, supplier or customer record was contacted.',
    differences_from_production: [
      'Disposable local Docker processes rather than a stable separately managed staging environment.',
      'Synthetic logical nodes and identities rather than real staging tenants or customer traffic.',
      'Four read-only HTTP probe adapters exercise the real authorization kernel but are not the production UI, queue worker or service transport adapters.',
      'No production deployment or cloud-provider audit log was observed.',
    ],
    runtime: Object.freeze({
      node: process.version,
      os: `${platform()} ${release()}`,
      docker_server: docker.server_version,
      docker_image: criteria.execution_environment.docker_image,
      docker_image_id: docker.image_id,
      docker_image_repo_digests: docker.repo_digests,
      network: 'none',
      physical_process_count: Object.keys(deployments).length,
      logical_node_count: logicalNodes.length,
    }),
    source_control: sourceControl,
    source_pair: sourcePair,
    external_contacts: Object.freeze({ production_hosts: 0, staging_hosts: 0, dns_providers: 0, databases: 0, payment_providers: 0 }),
    configuration_digest: `sha256:${sha256(Buffer.from([
      sourcePair.from_sha,
      sourcePair.to_sha,
      docker.image_id,
      candidateArtifact.artifact_identity,
      baselineArtifact.artifact_identity,
      sha256(Buffer.from(JSON.stringify(policy))),
    ].join('\n')))}`,
  });

  await Promise.all([
    writeFile(join(evidenceDirectory, 'shared-change.patch-id.txt'), patchEvidence, { flag: 'wx' }),
    writeJson(join(evidenceDirectory, 'single-build-provenance.json'), buildProvenance),
    writeJson(join(evidenceDirectory, 'immutable-artifact-manifest.json'), artifactManifest),
    writeJson(join(evidenceDirectory, 'node-pointer-timeline.json'), pointerTimeline),
    writeJson(join(evidenceDirectory, 'identity-feature-matrix.expected.json'), expectedMatrix),
    writeJson(join(evidenceDirectory, 'identity-feature-matrix.observed.json'), observedMatrix),
    writeJson(join(evidenceDirectory, 'single-node-rollback-and-isolation.json'), rollbackEvidence),
    writeJson(join(evidenceDirectory, 'environment.json'), environment),
  ]);
  await cleanupContainers();
  const oraclePath = join(evidenceDirectory, 'release-feature-independent-recount.json');
  const oracleResult = await execute('node', [
    '04_tools/scripts/audit/e10-release.oracle.mjs',
    '--run-directory', evidenceDirectory,
    '--criteria', criteriaPath,
    '--output', oraclePath,
  ], { cwd: repositoryRoot });
  if (oracleResult.exitCode !== 0) throw new Error(`E10_ORACLE_FAILED:${oracleResult.stderr}`);
  const oracle = await readJson(oraclePath);
  const executionSummary = Object.freeze({
    build_count: buildProvenance.build_invocations.length,
    candidate_artifact_identity_count: new Set(buildProvenance.candidate_artifact_assignments.map((entry) => entry.artifact_identity)).size,
    hosted_host_switch_count: actions.filter((entry) => entry.action_scope === 'hosted-host' && entry.action_kind === 'host-switch').length,
    hosted_per_node_action_count: actions.filter((entry) => entry.action_scope === 'hosted-node').length,
    pointer_snapshot_count: snapshots.length,
    expected_feature_cell_count: expectedMatrix.cells.length,
    observed_feature_cell_count: observedMatrix.cells.length,
    rollback_non_target_change_count: rollbackEvidence.non_target_change_count,
  });
  if (formalExecution) {
    await finalizeE10Evidence({
      evidenceDirectory,
      criteriaPath,
      criteria,
      sourceControl,
      sourcePair,
      startedAt,
      completedAt,
      environment,
      executionSummary,
      cleanup: Object.freeze({ containers_removed: true, temporary_working_directory_removed_after_finalization: true }),
      rawArtifactNames,
    });
    process.stdout.write(`SFL E10 formal evidence completed: ${repositoryPath(evidenceDirectory)} outcome=${oracle.claim_outcome}\n`);
  } else {
    if (oracle.claim_outcome !== 'MET') {
      throw new Error(`E10_ACCEPTANCE_${oracle.claim_outcome.replaceAll(' ', '_')}:${JSON.stringify({ missing: oracle.missing_items, violations: oracle.violations?.slice(0, 10) })}`);
    }
    process.stdout.write(`SFL E10 acceptance passed: cells=${observedMatrix.cells.length} builds=1 hosted-node-actions=0 rollback-spillover=0\n`);
  }
  completed = true;
} finally {
  await cleanupContainers();
  await rm(workingDirectory, { recursive: true, force: true });
  if (!formalExecution || !completed) await rm(evidenceDirectory, { recursive: true, force: true });
}

async function resolveSourcePair() {
  const explicitFrom = option('--from');
  const explicitTo = option('--to');
  if ((explicitFrom === undefined) !== (explicitTo === undefined)) throw new Error('E10_FROM_AND_TO_REQUIRED_TOGETHER');
  let fromRef = explicitFrom;
  let toRef = explicitTo;
  if (fromRef === undefined) {
    const commits = (await capture('git', ['log', '--format=%H', '--max-count=2', '--', markerRepositoryPath]))
      .trim().split('\n').filter(Boolean);
    if (commits.length !== 2) throw new Error('E10_MARKER_TRANSITION_COMMITS_MISSING');
    [toRef, fromRef] = commits;
  }
  const [fromSha, toSha] = await Promise.all([
    capture('git', ['rev-parse', `${fromRef}^{commit}`]).then((value) => value.trim()),
    capture('git', ['rev-parse', `${toRef}^{commit}`]).then((value) => value.trim()),
  ]);
  const mergeBase = (await capture('git', ['merge-base', fromSha, toSha])).trim();
  return Object.freeze({ from_sha: fromSha, to_sha: toSha, merge_base: mergeBase });
}

async function verifySourcePair(criteriaValue, pair) {
  if (pair.from_sha === pair.to_sha || pair.merge_base !== pair.from_sha) throw new Error('E10_SOURCE_PAIR_NOT_LINEAR');
  const changedPaths = (await capture('git', ['diff', '--name-only', pair.from_sha, pair.to_sha, '--']))
    .trim().split('\n').filter(Boolean);
  if (JSON.stringify(changedPaths) !== JSON.stringify([criteriaValue.shared_change.path])) {
    throw new Error(`E10_SHARED_CHANGE_SCOPE_INVALID:${JSON.stringify(changedPaths)}`);
  }
  const [markerA, markerB] = await Promise.all([
    capture('git', ['show', `${pair.from_sha}:${criteriaValue.shared_change.path}`]).then((value) => value.trim()),
    capture('git', ['show', `${pair.to_sha}:${criteriaValue.shared_change.path}`]).then((value) => value.trim()),
  ]);
  if (markerA !== criteriaValue.shared_change.marker_a || markerB !== criteriaValue.shared_change.marker_b) {
    throw new Error(`E10_SHARED_MARKER_INVALID:${markerA}:${markerB}`);
  }
}

async function createPatchEvidence(criteriaValue, pair) {
  const diff = await capture('git', ['diff', '--binary', pair.from_sha, pair.to_sha, '--', criteriaValue.shared_change.path]);
  const patchId = (await execute('git', ['patch-id', '--stable'], { cwd: repositoryRoot, input: diff })).stdout.trim().split(/\s+/)[0];
  const fields = {
    schema_version: 'e10-shared-change-patch-identity-v1',
    experiment: 'E10',
    from_sha: pair.from_sha,
    to_sha: pair.to_sha,
    merge_base: pair.merge_base,
    changed_path_count: 1,
    changed_path: criteriaValue.shared_change.path,
    marker_a: criteriaValue.shared_change.marker_a,
    marker_b: criteriaValue.shared_change.marker_b,
    patch_id_stable: patchId,
    diff_sha256: `sha256:${sha256(Buffer.from(diff))}`,
  };
  return `${Object.entries(fields).map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
}

function createProbePolicy(criteriaValue) {
  const operations = new Map(criteriaValue.probe_model.operations.map((operation) => [operation.id, operation]));
  return Object.freeze({
    schema_version: 'e10-probe-policy-v1',
    identities: criteriaValue.probe_model.identities.map((identity) => Object.freeze({
      ...identity,
      operations: identity.operation_ids.map((id) => Object.freeze({ id, permission: operations.get(id).permission })),
    })),
    nodes: criteriaValue.probe_model.nodes,
  });
}

function createArtifactManifest(criteriaValue, pair, candidate, baseline) {
  const candidateRuntime = fileEntry(candidate, 'probe/server.mjs');
  const baselineRuntime = fileEntry(baseline, 'probe/server.mjs');
  return Object.freeze({
    schema_version: 'e10-immutable-artifact-manifest-v1',
    experiment: 'E10',
    source_pair: pair,
    candidate_build_contract: Object.freeze({
      build_count: 1,
      candidate_artifact_identity_count: 1,
      node_specific_source_count: 0,
      node_specific_build_count: 0,
      eligible_nodes: logicalNodes,
    }),
    artifacts: Object.freeze({ A: baseline, B: candidate }),
    runtime_equivalence: Object.freeze({
      path: 'probe/server.mjs',
      baseline_sha256: baselineRuntime.sha256,
      candidate_sha256: candidateRuntime.sha256,
      byte_equal: baselineRuntime.sha256 === candidateRuntime.sha256 && baselineRuntime.size_bytes === candidateRuntime.size_bytes,
      expected_artifact_metadata_differences: Object.freeze(['release-version.json', 'runtime/release-version.json', 'shared-marker.txt']),
      source_diff_constraint: `Only ${criteriaValue.shared_change.path} changes from source A to source B.`,
    }),
    immutable_after_inventory: true,
  });
}

async function prepareDeploymentPointers(root) {
  for (const deployment of Object.keys(deployments)) {
    const directory = join(root, 'deployments', deployment);
    await mkdir(directory, { recursive: true });
    await symlink('../../artifacts/A', join(directory, 'current'));
  }
}

async function startContainer(input) {
  const deploymentPath = `/e10/deployments/${input.deployment}/current/probe/server.mjs`;
  const result = await execute('docker', [
    'run', '-d', '--rm', '--name', input.container,
    '--network', 'none',
    '--mount', `type=bind,source=${input.workingDirectory},target=/e10,readonly`,
    '--env', 'E10_POLICY_PATH=/e10/policies/node-policies.json',
    '--env', `E10_ALLOWED_NODES=${input.allowedNodes.join(',')}`,
    input.imageId,
    'node', deploymentPath,
  ]);
  if (result.exitCode !== 0) throw new Error(`E10_CONTAINER_START_FAILED:${input.container}:${result.stderr}`);
}

async function switchDeployment(deployment, expectedFrom, releaseTo, actionKind, sequence) {
  const descriptor = deployments[deployment];
  const container = containerNames[deployment];
  const directory = join(workingDirectory, 'deployments', deployment);
  const before = await readlink(join(directory, 'current'));
  if (!before.endsWith(`/artifacts/${expectedFrom}`)) throw new Error(`E10_POINTER_PRECONDITION_FAILED:${deployment}:${before}`);
  const started = new Date().toISOString();
  const temporary = join(directory, `current.next-${randomUUID()}`);
  await symlink(`../../artifacts/${releaseTo}`, temporary);
  await rename(temporary, join(directory, 'current'));
  const restart = await execute('docker', ['restart', container]);
  if (restart.exitCode !== 0) throw new Error(`E10_CONTAINER_RESTART_FAILED:${container}:${restart.stderr}`);
  await Promise.all(descriptor.nodes.map((node) => waitForHealth(container, node, releaseTo)));
  const after = await readlink(join(directory, 'current'));
  return Object.freeze({
    sequence,
    action_id: `e10-action-${sequence}`,
    action_kind: actionKind,
    action_scope: descriptor.kind,
    deployment,
    logical_nodes: descriptor.nodes,
    hosted_per_node_action: false,
    pointer_before: before,
    pointer_after: after,
    release_before: expectedFrom,
    release_after: releaseTo,
    started_at: started,
    completed_at: new Date().toISOString(),
    container_restart_exit_code: restart.exitCode,
  });
}

async function waitForFleet(expectedRelease) {
  await Promise.all(Object.entries(deployments).flatMap(([deployment, descriptor]) =>
    descriptor.nodes.map((node) => waitForHealth(containerNames[deployment], node, expectedRelease))));
}

async function waitForHealth(container, node, expectedRelease) {
  let last = '';
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await dockerFetch(container, `/health?node=${encodeURIComponent(node)}`, true);
    last = result.stdout || result.stderr;
    if (result.exitCode === 0) {
      try {
        const body = JSON.parse(result.stdout);
        if (body.status === 'ready' && body.release === expectedRelease) return body;
      } catch {}
    }
    await delay(100);
  }
  throw new Error(`E10_CONTAINER_NOT_READY:${container}:${node}:${expectedRelease}:${last}`);
}

async function captureFleetState(phase) {
  const capturedAt = new Date().toISOString();
  const nodes = {};
  for (const [deployment, descriptor] of Object.entries(deployments)) {
    const pointerTarget = await readlink(join(workingDirectory, 'deployments', deployment, 'current'));
    const containerInfo = JSON.parse((await capture('docker', ['inspect', '--format', '{{json .State}}', containerNames[deployment]])).trim());
    for (const node of descriptor.nodes) {
      const health = await waitForHealth(containerNames[deployment], node, pointerTarget.endsWith('/B') ? 'B' : 'A');
      nodes[node] = Object.freeze({
        node_id: node,
        deployment,
        deployment_kind: descriptor.kind,
        pointer_target: pointerTarget,
        release: health.release,
        source_sha: health.source_sha,
        build_id: health.build_id,
        marker: health.marker,
        health_status: health.status,
        container_id: containerInfo.Pid > 0 ? containerNames[deployment] : null,
        process_id: health.process_id,
        process_started_at: containerInfo.StartedAt,
      });
    }
  }
  return Object.freeze({ phase, captured_at: capturedAt, nodes: Object.freeze(nodes) });
}

function expectedFeatureMatrix(criteriaValue, snapshot, phase) {
  const cells = [];
  for (const nodeId of logicalNodes) {
    const node = criteriaValue.probe_model.nodes.find((entry) => entry.node_id === nodeId);
    for (const identity of criteriaValue.probe_model.identities) {
      for (const surface of surfaces) {
        const results = identity.operation_ids.map((operationId) => expectedOperation(criteriaValue, node, identity, operationId));
        cells.push(Object.freeze({
          phase,
          node_id: nodeId,
          deployment: snapshot.nodes[nodeId].deployment,
          release: snapshot.nodes[nodeId].release,
          source_sha: snapshot.nodes[nodeId].source_sha,
          marker: snapshot.nodes[nodeId].marker,
          identity_id: identity.identity_id,
          surface,
          allowed_operations: Object.freeze(results.filter((entry) => entry.allowed).map((entry) => entry.operation).sort()),
          denials: Object.freeze(results.filter((entry) => !entry.allowed).map((entry) => Object.freeze({ operation: entry.operation, reason: entry.reason })).sort(compareDenial)),
        }));
      }
    }
  }
  return Object.freeze(cells);
}

function expectedOperation(criteriaValue, node, identity, operationId) {
  const operation = criteriaValue.probe_model.operations.find((entry) => entry.id === operationId);
  if (!operation) throw new Error(`E10_OPERATION_DEFINITION_MISSING:${operationId}`);
  if (operation.audience === 'operator' && identity.target !== 'console') return denial(operationId, 'PERMISSION_DENIED');
  if (!operation.required_features.every((feature) => node.enabled_features.includes(feature))) return denial(operationId, 'FEATURE_NOT_DECLARED');
  if (!identity.permissions.includes(operation.permission)) return denial(operationId, 'PERMISSION_DENIED');
  if (!operation.scope_kinds.includes(identity.resolved_scope.kind) || !scopeContains(identity.grant_scope, identity.resolved_scope)) return denial(operationId, 'SCOPE_DENIED');
  if (!node.capabilities.includes(operationId)) return denial(operationId, 'CAPABILITY_DENIED');
  if (node.resource_not_ready_operations.includes(operationId)) return denial(operationId, 'RESOURCE_NOT_READY');
  return Object.freeze({ operation: operationId, allowed: true, reason: 'POLICY_ALLOWED' });
}

async function observedFeatureMatrix(criteriaValue, phase) {
  const cells = [];
  for (const nodeId of logicalNodes) {
    const deployment = deploymentForNode(nodeId);
    const batch = [];
    for (const identity of criteriaValue.probe_model.identities) {
      for (const surface of surfaces) batch.push(observeCell(containerNames[deployment], deployment, nodeId, identity.identity_id, surface, phase));
    }
    cells.push(...await Promise.all(batch));
  }
  return Object.freeze(cells);
}

async function observeCell(container, deployment, nodeId, identityId, surface, phase) {
  const result = await dockerFetch(container, `/${surface}/probe?node=${encodeURIComponent(nodeId)}&identity=${encodeURIComponent(identityId)}`);
  if (result.exitCode !== 0) throw new Error(`E10_PROBE_FAILED:${nodeId}:${identityId}:${surface}:${result.stderr}`);
  const body = JSON.parse(result.stdout);
  return Object.freeze({
    phase,
    node_id: nodeId,
    deployment,
    release: body.release,
    source_sha: body.source_sha,
    build_id: body.build_id,
    marker: body.marker,
    identity_id: identityId,
    surface,
    http_status: 200,
    engine: body.engine,
    allowed_operations: Object.freeze(body.results.filter((entry) => entry.allowed).map((entry) => entry.operation).sort()),
    denials: Object.freeze(body.results.filter((entry) => !entry.allowed).map((entry) => Object.freeze({ operation: entry.operation, reason: entry.reason })).sort(compareDenial)),
    decision_count: body.decisions.length,
    decisions: body.decisions,
  });
}

function createRollbackEvidence(before, after, observedBefore, observedAfter, receipt) {
  const nonTargetNodes = logicalNodes.filter((node) => node !== 'S-B');
  const stateDiffs = [];
  for (const node of nonTargetNodes) {
    const left = stableNodeState(before.nodes[node]);
    const right = stableNodeState(after.nodes[node]);
    if (JSON.stringify(left) !== JSON.stringify(right)) stateDiffs.push(Object.freeze({ node_id: node, before: left, after: right }));
  }
  const featureDiffs = [];
  for (const node of nonTargetNodes) {
    for (const identity of [...new Set(observedBefore.filter((entry) => entry.node_id === node).map((entry) => entry.identity_id))]) {
      for (const surface of surfaces) {
        const left = observedBefore.find((entry) => entry.node_id === node && entry.identity_id === identity && entry.surface === surface);
        const right = observedAfter.find((entry) => entry.node_id === node && entry.identity_id === identity && entry.surface === surface);
        const leftValue = featureCellState(left);
        const rightValue = featureCellState(right);
        if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) featureDiffs.push(Object.freeze({ node_id: node, identity_id: identity, surface, before: leftValue, after: rightValue }));
      }
    }
  }
  return Object.freeze({
    schema_version: 'e10-single-node-rollback-and-isolation-v1',
    experiment: 'E10',
    target_node: 'S-B',
    rollback_receipt: receipt,
    target_before: stableNodeState(before.nodes['S-B']),
    target_after: stableNodeState(after.nodes['S-B']),
    non_target_nodes: nonTargetNodes,
    non_target_state_diffs: Object.freeze(stateDiffs),
    non_target_feature_diffs: Object.freeze(featureDiffs),
    non_target_change_count: stateDiffs.length + featureDiffs.length,
    rollback_target_changed_from_b_to_a: before.nodes['S-B'].release === 'B' && after.nodes['S-B'].release === 'A',
  });
}

async function dockerFetch(container, path, allowFailure = false) {
  const program = `fetch(${JSON.stringify(`http://127.0.0.1:8787${path}`)}).then(async response => { const text = await response.text(); if (!response.ok) { process.stderr.write(text); process.exitCode = 2; } else { process.stdout.write(text.trim()); } }).catch(error => { process.stderr.write(error.message); process.exitCode = 3; });`;
  const result = await execute('docker', ['exec', container, 'node', '-e', program]);
  if (!allowFailure && result.exitCode !== 0) throw new Error(`E10_DOCKER_FETCH_FAILED:${container}:${path}:${result.stderr}`);
  return result;
}

async function dockerEnvironment(image) {
  const [serverVersion, imageData] = await Promise.all([
    capture('docker', ['version', '--format', '{{.Server.Version}}']).then((value) => value.trim()),
    capture('docker', ['image', 'inspect', '--format', '{{json .}}', image]).then((value) => JSON.parse(value)),
  ]);
  return Object.freeze({
    server_version: serverVersion,
    image_id: imageData.Id,
    repo_digests: imageData.RepoDigests ?? [],
  });
}

async function artifactInventory(root, releaseLabel, provenance) {
  const files = [];
  for (const path of await walk(root)) {
    const bytes = await readFile(path);
    const fileStat = await stat(path);
    files.push(Object.freeze({
      path: relative(root, path).replaceAll('\\', '/'),
      size_bytes: fileStat.size,
      sha256: `sha256:${sha256(bytes)}`,
    }));
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  return Object.freeze({
    release: releaseLabel,
    provenance,
    artifact_identity: `sha256:${inventoryDigest(files)}`,
    file_count: files.length,
    size_bytes: files.reduce((total, entry) => total + entry.size_bytes, 0),
    files: Object.freeze(files),
  });
}

async function walk(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

function inventoryDigest(files) {
  return sha256(Buffer.from(files.map((entry) => `${entry.path}\0${entry.size_bytes}\0${entry.sha256}\n`).join('')));
}

function fileEntry(artifact, path) {
  const entry = artifact.files.find((candidate) => candidate.path === path);
  if (!entry) throw new Error(`E10_ARTIFACT_FILE_MISSING:${artifact.release}:${path}`);
  return entry;
}

function denial(operation, reason) {
  return Object.freeze({ operation, allowed: false, reason });
}

function scopeContains(grant, resource) {
  if (grant.kind === 'platform') return true;
  if (grant.kind === 'self') return resource.kind === 'self' && grant.id === resource.id;
  if (grant.kind === 'owner') return resource.kind === 'owner' && grant.id === resource.id;
  if (grant.tenant !== undefined && resource.tenant !== grant.tenant) return false;
  return grant.id === resource.id || resource.path.some((ancestor) => ancestor.kind === grant.kind && ancestor.id === grant.id);
}

function compareDenial(left, right) {
  return left.operation.localeCompare(right.operation) || left.reason.localeCompare(right.reason);
}

function deploymentForNode(node) {
  const entry = Object.entries(deployments).find(([, descriptor]) => descriptor.nodes.includes(node));
  if (!entry) throw new Error(`E10_DEPLOYMENT_MISSING:${node}`);
  return entry[0];
}

function stableNodeState(node) {
  return Object.freeze({
    node_id: node.node_id,
    deployment: node.deployment,
    pointer_target: node.pointer_target,
    release: node.release,
    source_sha: node.source_sha,
    build_id: node.build_id,
    marker: node.marker,
    health_status: node.health_status,
  });
}

function featureCellState(cell) {
  if (!cell) return null;
  return Object.freeze({ allowed_operations: cell.allowed_operations, denials: cell.denials });
}

async function verifyCriteriaSources(criteriaValue) {
  for (const source of [...criteriaValue.authoritative_basis, ...criteriaValue.implementation_basis]) {
    const path = source.path.split('#')[0];
    const bytes = source.git_commit
      ? await capture('git', ['show', `${source.git_commit}:${path}`])
      : await readFile(join(repositoryRoot, path));
    if (`sha256:${sha256(bytes)}` !== source.sha256) throw new Error(`E10_BASIS_DIGEST_MISMATCH:${source.path}`);
  }
}

async function sourceControlState() {
  const [sha, statusOutput] = await Promise.all([
    capture('git', ['rev-parse', 'HEAD']).then((value) => value.trim()),
    capture('git', ['status', '--porcelain=v1', '--untracked-files=all']),
  ]);
  return Object.freeze({ sha, tree_state: statusOutput.trim() ? 'DIRTY' : 'CLEAN', porcelain: statusOutput.trim().split('\n').filter(Boolean) });
}

async function cleanupContainers() {
  for (const container of [...startedContainers].reverse()) await execute('docker', ['rm', '-f', container]);
  startedContainers.length = 0;
}

function option(name) {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`E10_OPTION_VALUE_MISSING:${name}`);
  return value;
}

function assertRepositoryEvidencePath(path) {
  const relativePath = repositoryPath(path);
  if (relativePath.startsWith('..') || !relativePath.startsWith('05_docs_ziliao/docs_wendang/architecture/evidence/e2.0/runs/')) {
    throw new Error(`E10_EVIDENCE_PATH_INVALID:${relativePath}`);
  }
}

function repositoryPath(path) {
  return relative(repositoryRoot, path).replaceAll('\\', '/');
}

function readJson(path) {
  return readFile(path, 'utf8').then(JSON.parse);
}

function writeJson(path, value) {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function capture(command, args) {
  return execute(command, args, { cwd: repositoryRoot }).then((result) => {
    if (result.exitCode !== 0) throw new Error(`E10_COMMAND_FAILED:${command}:${result.exitCode}:${result.stderr}`);
    return result.stdout;
  });
}

async function execute(command, args, options = {}) {
  return await new Promise((resolveExecution, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repositoryRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolveExecution({ exitCode: code ?? 1, signal, stdout, stderr }));
    if (options.input !== undefined) child.stdin.end(options.input);
    else child.stdin.end();
  });
}
