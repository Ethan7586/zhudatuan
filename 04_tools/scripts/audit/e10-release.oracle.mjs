#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const runDirectory = resolve(repositoryRoot, requiredOption('--run-directory'));
const criteriaPath = resolve(repositoryRoot, requiredOption('--criteria'));
const outputPath = resolve(repositoryRoot, requiredOption('--output'));
const criteria = await readJson(criteriaPath);
const missing = [];
const inputs = {};
for (const [key, filename, format] of [
  ['patch', 'shared-change.patch-id.txt', 'text'],
  ['build', 'single-build-provenance.json', 'json'],
  ['artifact', 'immutable-artifact-manifest.json', 'json'],
  ['timeline', 'node-pointer-timeline.json', 'json'],
  ['expected', 'identity-feature-matrix.expected.json', 'json'],
  ['observed', 'identity-feature-matrix.observed.json', 'json'],
  ['rollback', 'single-node-rollback-and-isolation.json', 'json'],
  ['environment', 'environment.json', 'json'],
]) {
  try {
    const value = await readFile(join(runDirectory, filename), 'utf8');
    inputs[key] = format === 'json' ? JSON.parse(value) : parseProperties(value);
  } catch (cause) {
    missing.push(`${filename}: ${cause instanceof Error ? cause.message : 'unreadable'}`);
  }
}
if (missing.length === 0) collectMissing(criteria, inputs, missing);

let reconciliation = emptyReconciliation();
let patchViolations = [];
if (missing.length === 0) {
  try {
    reconciliation = reconcile(criteria, inputs);
    patchViolations = await verifyPatch(criteria, inputs.patch);
  } catch (cause) {
    missing.push(`malformed reconciliation input: ${cause instanceof Error ? cause.message : 'unknown error'}`);
  }
}
const negativeProbes = missing.length === 0 ? runNegativeProbes(criteria, inputs) : [];
const negativeMissCount = negativeProbes.filter((probe) => !probe.detected).length;
const violations = Object.freeze([...patchViolations, ...reconciliation.violations]);
const metrics = Object.freeze({ ...reconciliation.metrics, negative_probe_miss_count: negativeMissCount });
const claimOutcome = missing.length > 0 ? 'UNKNOWN' : violations.length > 0 || negativeMissCount > 0 ? 'NOT MET' : 'MET';
const thresholds = Object.freeze([
  threshold('required_missing_count', 0, missing.length),
  threshold('patch_mismatch_count', 0, patchViolations.length),
  threshold('candidate_build_count', 1, metrics.candidate_build_count),
  threshold('candidate_artifact_identity_count', 1, metrics.candidate_artifact_identity_count),
  threshold('node_specific_source_and_build_count', 0, metrics.node_specific_source_and_build_count),
  threshold('hosted_host_switch_count', 1, metrics.hosted_host_switch_count),
  threshold('hosted_per_node_action_count', 0, metrics.hosted_per_node_action_count),
  threshold('pointer_mismatch_count', 0, metrics.pointer_mismatch_count),
  threshold('feature_cell_completeness_mismatch_count', 0, metrics.feature_cell_completeness_mismatch_count),
  threshold('expected_declaration_difference_count', 0, metrics.expected_declaration_difference_count),
  threshold('observed_capability_symmetric_difference_count', 0, metrics.observed_capability_symmetric_difference_count),
  threshold('denial_reason_mismatch_count', 0, metrics.denial_reason_mismatch_count),
  threshold('rollback_non_target_change_count', 0, metrics.rollback_non_target_change_count),
  threshold('negative_oracle_probe_miss_count', 0, metrics.negative_probe_miss_count),
]);
const output = Object.freeze({
  schema_version: 'e10-release-feature-independent-recount-v1',
  oracle_id: criteria.independent_oracle.oracle_id,
  executed_at: new Date().toISOString(),
  reads_test_program_pass: false,
  input_artifacts: criteria.required_input_artifacts,
  claim_outcome: claimOutcome,
  environment_assurance: claimOutcome === 'MET' && inputs.environment?.kind === 'DEV' ? 'DEV VERIFIED' : 'NOT ESTABLISHED',
  review_assurance: 'NOT REVIEWED',
  missing_items: Object.freeze([...new Set(missing)].sort()),
  thresholds,
  metrics,
  violations,
  negative_probes: Object.freeze(negativeProbes),
});
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`E10 oracle: ${claimOutcome}; missing=${missing.length}; violations=${violations.length}; negative-misses=${negativeMissCount}\n`);

function collectMissing(criteriaValue, value, outputMissing) {
  for (const field of ['from_sha', 'to_sha', 'merge_base', 'changed_path', 'marker_a', 'marker_b', 'patch_id_stable', 'diff_sha256']) {
    requireValue(value.patch?.[field], `patch.${field}`, outputMissing);
  }
  requireArray(value.build?.build_invocations, 'build.build_invocations', outputMissing, true);
  requireArray(value.build?.node_specific_builds, 'build.node_specific_builds', outputMissing, false);
  requireArray(value.build?.candidate_artifact_assignments, 'build.candidate_artifact_assignments', outputMissing, true);
  for (const invocation of array(value.build?.build_invocations)) {
    for (const field of ['invocation_id', 'scope', 'source_sha', 'started_at', 'completed_at', 'exit_code', 'artifact_identity']) {
      requireValue(invocation?.[field], `build invocation ${field}`, outputMissing);
    }
  }
  for (const release of ['A', 'B']) {
    const artifact = value.artifact?.artifacts?.[release];
    requireObject(artifact, `artifact ${release}`, outputMissing);
    requireValue(artifact?.artifact_identity, `artifact ${release} identity`, outputMissing);
    requireValue(artifact?.file_count, `artifact ${release} file count`, outputMissing);
    requireValue(artifact?.size_bytes, `artifact ${release} size`, outputMissing);
    requireArray(artifact?.files, `artifact ${release} files`, outputMissing, true);
    for (const file of array(artifact?.files)) {
      for (const field of ['path', 'size_bytes', 'sha256']) requireValue(file?.[field], `artifact ${release} file ${field}`, outputMissing);
    }
  }
  requireObject(value.artifact?.runtime_equivalence, 'artifact runtime equivalence', outputMissing);
  requireArray(value.timeline?.actions, 'timeline actions', outputMissing, true);
  requireArray(value.timeline?.snapshots, 'timeline snapshots', outputMissing, true);
  for (const action of array(value.timeline?.actions)) {
    for (const field of ['sequence', 'action_kind', 'action_scope', 'deployment', 'release_before', 'release_after', 'started_at', 'completed_at']) {
      requireValue(action?.[field], `timeline action ${field}`, outputMissing);
    }
    requireArray(action?.logical_nodes, `timeline action ${action?.sequence} logical nodes`, outputMissing, true);
  }
  for (const phase of criteriaValue.release_topology.required_pointer_phases) {
    const snapshot = array(value.timeline?.snapshots).find((entry) => entry?.phase === phase.phase);
    requireObject(snapshot, `timeline phase ${phase.phase}`, outputMissing);
    for (const node of criteriaValue.release_topology.logical_nodes) {
      const nodeState = snapshot?.nodes?.[node];
      requireObject(nodeState, `timeline ${phase.phase} node ${node}`, outputMissing);
      for (const field of ['deployment', 'pointer_target', 'release', 'source_sha', 'build_id', 'marker', 'health_status']) {
        requireValue(nodeState?.[field], `timeline ${phase.phase} ${node} ${field}`, outputMissing);
      }
    }
  }
  requireArray(value.expected?.cells, 'expected cells', outputMissing, true);
  requireObject(value.expected?.model, 'expected raw model', outputMissing);
  requireArray(value.observed?.cells, 'observed cells', outputMissing, true);
  for (const [name, cells] of [['expected', value.expected?.cells], ['observed', value.observed?.cells]]) {
    for (const cell of array(cells)) {
      for (const field of ['phase', 'node_id', 'deployment', 'release', 'source_sha', 'marker', 'identity_id', 'surface']) {
        requireValue(cell?.[field], `${name} cell ${field}`, outputMissing);
      }
      requireArray(cell?.allowed_operations, `${name} cell allowed operations`, outputMissing, false);
      requireArray(cell?.denials, `${name} cell denials`, outputMissing, false);
      for (const denial of array(cell?.denials)) {
        requireValue(denial?.operation, `${name} denial operation`, outputMissing);
        requireValue(denial?.reason, `${name} denial reason`, outputMissing);
      }
    }
  }
  requireValue(value.rollback?.target_node, 'rollback target node', outputMissing);
  requireObject(value.rollback?.rollback_receipt, 'rollback receipt', outputMissing);
  requireObject(value.rollback?.target_before, 'rollback target before', outputMissing);
  requireObject(value.rollback?.target_after, 'rollback target after', outputMissing);
  requireArray(value.rollback?.non_target_nodes, 'rollback non-target nodes', outputMissing, true);
  requireArray(value.rollback?.non_target_state_diffs, 'rollback non-target state diffs', outputMissing, false);
  requireArray(value.rollback?.non_target_feature_diffs, 'rollback non-target feature diffs', outputMissing, false);
  for (const field of ['kind', 'environment_id', 'description', 'owner', 'isolation', 'real_customer_data', 'production_impact', 'differences_from_production', 'runtime', 'source_control', 'source_pair', 'external_contacts', 'configuration_digest']) {
    requireValue(value.environment?.[field], `environment.${field}`, outputMissing);
  }
}

function reconcile(criteriaValue, value) {
  const violations = [];
  const metrics = {
    candidate_build_count: array(value.build.build_invocations).length,
    candidate_artifact_identity_count: new Set(array(value.build.candidate_artifact_assignments).map((entry) => entry.artifact_identity)).size,
    node_specific_source_and_build_count: Number(value.artifact.candidate_build_contract?.node_specific_source_count ?? 0)
      + Number(value.artifact.candidate_build_contract?.node_specific_build_count ?? 0)
      + array(value.build.node_specific_builds).length,
    hosted_host_switch_count: array(value.timeline.actions).filter((entry) => entry.action_scope === 'hosted-host' && entry.action_kind === 'host-switch').length,
    hosted_per_node_action_count: array(value.timeline.actions).filter((entry) => entry.action_scope === 'hosted-node' || entry.hosted_per_node_action === true).length,
    pointer_mismatch_count: 0,
    feature_cell_completeness_mismatch_count: 0,
    expected_declaration_difference_count: 0,
    observed_capability_symmetric_difference_count: 0,
    denial_reason_mismatch_count: 0,
    rollback_non_target_change_count: 0,
  };
  const add = (code, detail, count = 1) => violations.push(Object.freeze({ code, count, detail }));

  if (metrics.candidate_build_count !== 1) add('CANDIDATE_BUILD_COUNT_MISMATCH', { actual: metrics.candidate_build_count, expected: 1 }, Math.abs(metrics.candidate_build_count - 1));
  if (metrics.candidate_artifact_identity_count !== 1) add('CANDIDATE_ARTIFACT_IDENTITY_COUNT_MISMATCH', { actual: metrics.candidate_artifact_identity_count, expected: 1 });
  if (metrics.node_specific_source_and_build_count !== 0) add('NODE_SPECIFIC_BUILD_OR_SOURCE_FOUND', { actual: metrics.node_specific_source_and_build_count });
  for (const invocation of array(value.build.build_invocations)) {
    if (invocation.exit_code !== 0 || invocation.scope !== 'shared-kernel-candidate' || invocation.assigned_node_id !== null || invocation.source_sha !== value.patch.to_sha) {
      add('BUILD_PROVENANCE_MISMATCH', { invocation_id: invocation.invocation_id });
    }
  }
  const candidateIdentity = value.artifact.artifacts.B.artifact_identity;
  for (const assignment of array(value.build.candidate_artifact_assignments)) {
    if (assignment.artifact_identity !== candidateIdentity || assignment.release !== 'B') add('CANDIDATE_ASSIGNMENT_MISMATCH', { assignment });
  }
  const assignedNodes = array(value.build.candidate_artifact_assignments).map((entry) => entry.node_id).sort();
  const expectedAssignedNodes = criteriaValue.release_topology.logical_nodes.filter((node) => node !== 'S-C').sort();
  const assignmentMismatch = multisetDifference(assignedNodes, expectedAssignedNodes);
  if (assignmentMismatch > 0) add('CANDIDATE_ASSIGNMENT_NODE_SET_MISMATCH', { actual: assignedNodes, expected: expectedAssignedNodes }, assignmentMismatch);

  for (const releaseName of ['A', 'B']) {
    const artifact = value.artifact.artifacts[releaseName];
    const files = array(artifact.files);
    const recountedIdentity = `sha256:${inventoryDigest(files)}`;
    const recountedSize = files.reduce((total, entry) => total + Number(entry.size_bytes), 0);
    if (artifact.artifact_identity !== recountedIdentity) add('ARTIFACT_IDENTITY_RECOUNT_MISMATCH', { release: releaseName, declared: artifact.artifact_identity, recounted: recountedIdentity });
    if (artifact.file_count !== files.length) add('ARTIFACT_FILE_COUNT_MISMATCH', { release: releaseName, declared: artifact.file_count, recounted: files.length });
    if (artifact.size_bytes !== recountedSize) add('ARTIFACT_SIZE_RECOUNT_MISMATCH', { release: releaseName, declared: artifact.size_bytes, recounted: recountedSize });
    if (new Set(files.map((entry) => entry.path)).size !== files.length) add('ARTIFACT_DUPLICATE_FILE_PATH', { release: releaseName });
    for (const file of files) if (!validSha(file.sha256) || !Number.isSafeInteger(file.size_bytes) || file.size_bytes < 0) add('ARTIFACT_FILE_ENTRY_INVALID', { release: releaseName, path: file.path });
  }
  const equivalence = value.artifact.runtime_equivalence;
  const runtimeA = array(value.artifact.artifacts.A.files).find((entry) => entry.path === equivalence.path);
  const runtimeB = array(value.artifact.artifacts.B.files).find((entry) => entry.path === equivalence.path);
  if (!equivalence.byte_equal || !runtimeA || !runtimeB || runtimeA.sha256 !== runtimeB.sha256 || runtimeA.size_bytes !== runtimeB.size_bytes) {
    add('SHARED_RUNTIME_NOT_BYTE_EQUAL', { equivalence, runtimeA, runtimeB });
  }

  const expectedActions = criteriaValue.release_topology.required_actions;
  const actualActions = [...array(value.timeline.actions)].sort((left, right) => Number(left.sequence) - Number(right.sequence));
  if (actualActions.length !== expectedActions.length) {
    metrics.pointer_mismatch_count += Math.abs(actualActions.length - expectedActions.length);
    add('POINTER_ACTION_COUNT_MISMATCH', { actual: actualActions.length, expected: expectedActions.length });
  }
  for (let index = 0; index < expectedActions.length; index += 1) {
    const expectedAction = expectedActions[index];
    const action = actualActions[index];
    if (!action || ['sequence', 'deployment', 'action_kind', 'release_before', 'release_after', 'action_scope'].some((field) => action[field] !== expectedAction[field])) {
      metrics.pointer_mismatch_count += 1;
      add('POINTER_ACTION_MISMATCH', { index, actual: action, expected: expectedAction });
    }
  }
  for (let index = 1; index < actualActions.length; index += 1) {
    if (Date.parse(actualActions[index - 1].completed_at) >= Date.parse(actualActions[index].started_at)) {
      metrics.pointer_mismatch_count += 1;
      add('POINTER_ACTION_TIME_NOT_STAGGERED', { previous: actualActions[index - 1].action_id, next: actualActions[index].action_id });
    }
  }
  const snapshots = new Map(array(value.timeline.snapshots).map((snapshot) => [snapshot.phase, snapshot]));
  for (const expectedPhase of criteriaValue.release_topology.required_pointer_phases) {
    const snapshot = snapshots.get(expectedPhase.phase);
    if (!snapshot) {
      metrics.pointer_mismatch_count += criteriaValue.release_topology.logical_nodes.length;
      add('POINTER_PHASE_MISSING', { phase: expectedPhase.phase });
      continue;
    }
    for (const node of criteriaValue.release_topology.logical_nodes) {
      const actual = snapshot.nodes[node];
      const expectedRelease = expectedPhase.releases[node];
      const expectedSource = expectedRelease === 'B' ? value.patch.to_sha : value.patch.from_sha;
      const expectedMarker = expectedRelease === 'B' ? criteriaValue.shared_change.marker_b : criteriaValue.shared_change.marker_a;
      if (!actual || actual.release !== expectedRelease || actual.source_sha !== expectedSource || actual.marker !== expectedMarker || actual.health_status !== 'ready' || !actual.pointer_target.endsWith(`/artifacts/${expectedRelease}`)) {
        metrics.pointer_mismatch_count += 1;
        add('POINTER_NODE_STATE_MISMATCH', { phase: expectedPhase.phase, node, actual, expected: { release: expectedRelease, source_sha: expectedSource, marker: expectedMarker } });
      }
    }
    const hosted = ['H-A', 'H-B', 'H-C'].map((node) => snapshot.nodes[node]);
    if (new Set(hosted.map((entry) => `${entry?.deployment}|${entry?.pointer_target}|${entry?.release}|${entry?.process_id}`)).size !== 1) {
      metrics.pointer_mismatch_count += 1;
      add('HOSTED_NODES_NOT_ONE_HOST_PROCESS', { phase: expectedPhase.phase });
    }
  }
  if (metrics.hosted_host_switch_count !== 1) add('HOSTED_HOST_SWITCH_COUNT_MISMATCH', { actual: metrics.hosted_host_switch_count, expected: 1 });
  if (metrics.hosted_per_node_action_count !== 0) add('HOSTED_PER_NODE_ACTION_FOUND', { actual: metrics.hosted_per_node_action_count });

  const expectedKeys = requiredCellKeys(criteriaValue);
  const expectedIndex = cellIndex(value.expected.cells);
  const observedIndex = cellIndex(value.observed.cells);
  metrics.feature_cell_completeness_mismatch_count = keyMismatch(expectedIndex, expectedKeys) + keyMismatch(observedIndex, expectedKeys);
  if (metrics.feature_cell_completeness_mismatch_count > 0) add('FEATURE_CELL_COMPLETENESS_MISMATCH', { count: metrics.feature_cell_completeness_mismatch_count });
  const phaseSnapshots = new Map([
    ['after_staggered_activation', snapshots.get('sovereign_b_after_later_activation')],
    ['after_s_b_rollback', snapshots.get('after_s_b_single_node_rollback')],
  ]);
  for (const key of expectedKeys) {
    const coordinates = parseCellKey(key);
    const recomputed = recomputeExpected(criteriaValue, coordinates.node_id, coordinates.identity_id);
    const expectedCell = expectedIndex.get(key)?.[0];
    const observedCell = observedIndex.get(key)?.[0];
    const snapshotNode = phaseSnapshots.get(coordinates.phase)?.nodes?.[coordinates.node_id];
    if (expectedCell) {
      const allowedDifference = setDifferenceCount(expectedCell.allowed_operations, recomputed.allowed_operations);
      const denialDifference = denialDifferenceCount(expectedCell.denials, recomputed.denials);
      metrics.expected_declaration_difference_count += allowedDifference + denialDifference;
      if (allowedDifference + denialDifference > 0) add('EXPECTED_DECLARATION_DIFFERS_FROM_RECOUNT', { key, allowedDifference, denialDifference });
      if (!cellReleaseMatches(expectedCell, snapshotNode)) {
        metrics.expected_declaration_difference_count += 1;
        add('EXPECTED_CELL_RELEASE_MISMATCH', { key });
      }
    }
    if (observedCell) {
      const allowedDifference = setDifferenceCount(observedCell.allowed_operations, recomputed.allowed_operations);
      const denialDifference = denialOperationDifferenceCount(observedCell.denials, recomputed.denials);
      const reasonDifference = denialReasonDifferenceCount(observedCell.denials, recomputed.denials);
      metrics.observed_capability_symmetric_difference_count += allowedDifference + denialDifference;
      metrics.denial_reason_mismatch_count += reasonDifference;
      if (allowedDifference + denialDifference > 0) add('OBSERVED_CAPABILITY_DIFFERS_FROM_RECOUNT', { key, allowedDifference, denialDifference });
      if (reasonDifference > 0) add('OBSERVED_DENIAL_REASON_MISMATCH', { key, reasonDifference });
      const operationCount = identityById(criteriaValue, coordinates.identity_id).operation_ids.length;
      if (observedCell.http_status !== 200 || observedCell.engine !== 'AccessPipeline+NodeOperationAvailabilityResolver' || observedCell.decision_count !== operationCount || !cellReleaseMatches(observedCell, snapshotNode)) {
        metrics.observed_capability_symmetric_difference_count += 1;
        add('OBSERVED_CELL_PROVENANCE_MISMATCH', { key });
      }
    }
  }

  const beforeRollback = snapshots.get('sovereign_b_after_later_activation');
  const afterRollback = snapshots.get('after_s_b_single_node_rollback');
  const nonTargets = criteriaValue.release_topology.logical_nodes.filter((node) => node !== 'S-B');
  let rollbackChanges = 0;
  for (const node of nonTargets) {
    if (JSON.stringify(stableNode(beforeRollback?.nodes?.[node])) !== JSON.stringify(stableNode(afterRollback?.nodes?.[node]))) rollbackChanges += 1;
    for (const identity of criteriaValue.probe_model.identities) {
      for (const surface of criteriaValue.probe_model.surfaces) {
        const left = observedIndex.get(cellKey('after_staggered_activation', node, identity.identity_id, surface))?.[0];
        const right = observedIndex.get(cellKey('after_s_b_rollback', node, identity.identity_id, surface))?.[0];
        if (JSON.stringify(featureProjection(left)) !== JSON.stringify(featureProjection(right))) rollbackChanges += 1;
      }
    }
  }
  metrics.rollback_non_target_change_count = rollbackChanges;
  if (rollbackChanges > 0) add('ROLLBACK_NON_TARGET_CHANGE', { count: rollbackChanges }, rollbackChanges);
  if (beforeRollback?.nodes?.['S-B']?.release !== 'B' || afterRollback?.nodes?.['S-B']?.release !== 'A') add('ROLLBACK_TARGET_DID_NOT_CHANGE_B_TO_A', {});
  if (value.rollback.target_node !== 'S-B' || Number(value.rollback.non_target_change_count) !== rollbackChanges
    || array(value.rollback.non_target_state_diffs).length + array(value.rollback.non_target_feature_diffs).length !== rollbackChanges) {
    add('ROLLBACK_DECLARED_RECOUNT_MISMATCH', { declared: value.rollback.non_target_change_count, recounted: rollbackChanges });
  }
  if (value.environment.kind !== 'DEV' || value.environment.source_control?.tree_state !== 'CLEAN'
    || value.environment.source_pair?.from_sha !== value.patch.from_sha || value.environment.source_pair?.to_sha !== value.patch.to_sha
    || Object.values(value.environment.external_contacts ?? {}).some((count) => Number(count) !== 0)) {
    add('ENVIRONMENT_PROVENANCE_MISMATCH', { kind: value.environment.kind, source_control: value.environment.source_control, external_contacts: value.environment.external_contacts });
  }
  return Object.freeze({ metrics: Object.freeze(metrics), violations: Object.freeze(violations) });
}

async function verifyPatch(criteriaValue, patch) {
  const violations = [];
  const add = (code, detail) => violations.push(Object.freeze({ code, count: 1, detail }));
  if (patch.changed_path !== criteriaValue.shared_change.path || Number(patch.changed_path_count) !== 1
    || patch.marker_a !== criteriaValue.shared_change.marker_a || patch.marker_b !== criteriaValue.shared_change.marker_b
    || patch.from_sha === patch.to_sha || patch.merge_base !== patch.from_sha) {
    add('PATCH_DECLARATION_MISMATCH', { patch });
    return violations;
  }
  const mergeBase = (await capture('git', ['merge-base', patch.from_sha, patch.to_sha])).trim();
  const changedPaths = (await capture('git', ['diff', '--name-only', patch.from_sha, patch.to_sha, '--'])).trim().split('\n').filter(Boolean);
  const diff = await capture('git', ['diff', '--binary', patch.from_sha, patch.to_sha, '--', criteriaValue.shared_change.path]);
  const patchId = (await execute('git', ['patch-id', '--stable'], diff)).stdout.trim().split(/\s+/)[0];
  const [markerA, markerB] = await Promise.all([
    capture('git', ['show', `${patch.from_sha}:${criteriaValue.shared_change.path}`]).then((value) => value.trim()),
    capture('git', ['show', `${patch.to_sha}:${criteriaValue.shared_change.path}`]).then((value) => value.trim()),
  ]);
  if (mergeBase !== patch.from_sha || JSON.stringify(changedPaths) !== JSON.stringify([criteriaValue.shared_change.path])
    || markerA !== criteriaValue.shared_change.marker_a || markerB !== criteriaValue.shared_change.marker_b
    || patch.diff_sha256 !== `sha256:${sha256(Buffer.from(diff))}` || patch.patch_id_stable !== patchId) {
    add('PATCH_GIT_RECOUNT_MISMATCH', { mergeBase, changedPaths, markerA, markerB, patchId, diff_sha256: `sha256:${sha256(Buffer.from(diff))}` });
  }
  return violations;
}

function runNegativeProbes(criteriaValue, original) {
  const probes = [];
  const duplicateBuild = structuredClone(original);
  duplicateBuild.build.build_invocations.push({
    ...duplicateBuild.build.build_invocations[0],
    invocation_id: 'negative-extra-build',
    artifact_identity: `sha256:${'f'.repeat(64)}`,
  });
  duplicateBuild.build.candidate_artifact_assignments.push({ node_id: 'negative-node', release: 'B', artifact_identity: `sha256:${'f'.repeat(64)}` });
  const duplicateResult = reconcile(criteriaValue, duplicateBuild);
  probes.push(Object.freeze({
    probe_id: 'duplicate-or-nonequivalent-candidate-artifact',
    mutation: 'Add a second build invocation and candidate artifact identity.',
    detected: duplicateResult.metrics.candidate_build_count !== 1 && duplicateResult.metrics.candidate_artifact_identity_count !== 1,
    detected_codes: duplicateResult.violations.map((entry) => entry.code).filter((code) => code.includes('BUILD') || code.includes('ARTIFACT')),
  }));

  const exposedDenied = structuredClone(original);
  const deniedCell = exposedDenied.expected.cells.find((cell) => cell.denials.length > 0);
  const observedCell = exposedDenied.observed.cells.find((cell) => cellKeyFromCell(cell) === cellKeyFromCell(deniedCell));
  const deniedOperation = deniedCell?.denials?.[0]?.operation;
  if (observedCell && deniedOperation) {
    observedCell.allowed_operations.push(deniedOperation);
    observedCell.denials = observedCell.denials.filter((entry) => entry.operation !== deniedOperation);
  }
  const exposureResult = reconcile(criteriaValue, exposedDenied);
  probes.push(Object.freeze({
    probe_id: 'denied-feature-exposed-on-one-surface',
    mutation: 'Move one independently denied operation into one observed allowed set.',
    detected: exposureResult.metrics.observed_capability_symmetric_difference_count > 0,
    detected_codes: exposureResult.violations.map((entry) => entry.code).filter((code) => code.includes('OBSERVED')),
  }));

  const rollbackSpillover = structuredClone(original);
  const after = rollbackSpillover.timeline.snapshots.find((snapshot) => snapshot.phase === 'after_s_b_single_node_rollback');
  after.nodes['H-A'].release = 'A';
  after.nodes['H-A'].source_sha = rollbackSpillover.patch.from_sha;
  after.nodes['H-A'].marker = criteriaValue.shared_change.marker_a;
  after.nodes['H-A'].pointer_target = '../../artifacts/A';
  const rollbackResult = reconcile(criteriaValue, rollbackSpillover);
  probes.push(Object.freeze({
    probe_id: 'rollback-nontarget-spillover',
    mutation: 'Move non-target H-A from B to A in the post-rollback pointer snapshot.',
    detected: rollbackResult.metrics.rollback_non_target_change_count > 0,
    detected_codes: rollbackResult.violations.map((entry) => entry.code).filter((code) => code.includes('ROLLBACK') || code.includes('POINTER')),
  }));
  return probes;
}

function recomputeExpected(criteriaValue, nodeId, identityId) {
  const node = criteriaValue.probe_model.nodes.find((entry) => entry.node_id === nodeId);
  const identity = identityById(criteriaValue, identityId);
  const results = identity.operation_ids.map((operationId) => {
    const operation = criteriaValue.probe_model.operations.find((entry) => entry.id === operationId);
    let reason = null;
    if (operation.audience === 'operator' && identity.target !== 'console') reason = 'PERMISSION_DENIED';
    else if (!operation.required_features.every((feature) => node.enabled_features.includes(feature))) reason = 'FEATURE_NOT_DECLARED';
    else if (!identity.permissions.includes(operation.permission)) reason = 'PERMISSION_DENIED';
    else if (!operation.scope_kinds.includes(identity.resolved_scope.kind) || !scopeContains(identity.grant_scope, identity.resolved_scope)) reason = 'SCOPE_DENIED';
    else if (!node.capabilities.includes(operationId)) reason = 'CAPABILITY_DENIED';
    else if (node.resource_not_ready_operations.includes(operationId)) reason = 'RESOURCE_NOT_READY';
    return { operation: operationId, reason };
  });
  return Object.freeze({
    allowed_operations: Object.freeze(results.filter((entry) => entry.reason === null).map((entry) => entry.operation).sort()),
    denials: Object.freeze(results.filter((entry) => entry.reason !== null).map((entry) => Object.freeze({ operation: entry.operation, reason: entry.reason })).sort(compareDenial)),
  });
}

function requiredCellKeys(criteriaValue) {
  const output = [];
  for (const phase of criteriaValue.probe_model.phases) {
    for (const node of criteriaValue.release_topology.logical_nodes) {
      for (const identity of criteriaValue.probe_model.identities) {
        for (const surface of criteriaValue.probe_model.surfaces) output.push(cellKey(phase, node, identity.identity_id, surface));
      }
    }
  }
  return output;
}

function cellIndex(cells) {
  const output = new Map();
  for (const cell of array(cells)) {
    const key = cellKeyFromCell(cell);
    if (!output.has(key)) output.set(key, []);
    output.get(key).push(cell);
  }
  return output;
}

function keyMismatch(index, expectedKeys) {
  const expected = new Set(expectedKeys);
  let count = 0;
  for (const key of expectedKeys) count += Math.abs((index.get(key)?.length ?? 0) - 1);
  for (const [key, entries] of index) if (!expected.has(key)) count += entries.length;
  return count;
}

function cellKeyFromCell(cell) {
  return cellKey(cell.phase, cell.node_id, cell.identity_id, cell.surface);
}

function cellKey(phase, node, identity, surface) {
  return `${phase}|${node}|${identity}|${surface}`;
}

function parseCellKey(key) {
  const [phase, node_id, identity_id, surface] = key.split('|');
  return { phase, node_id, identity_id, surface };
}

function identityById(criteriaValue, identityId) {
  const identity = criteriaValue.probe_model.identities.find((entry) => entry.identity_id === identityId);
  if (!identity) throw new Error(`E10_IDENTITY_MISSING:${identityId}`);
  return identity;
}

function cellReleaseMatches(cell, node) {
  return Boolean(node) && cell.release === node.release && cell.source_sha === node.source_sha && cell.marker === node.marker && cell.deployment === node.deployment;
}

function stableNode(node) {
  if (!node) return null;
  return {
    node_id: node.node_id,
    deployment: node.deployment,
    pointer_target: node.pointer_target,
    release: node.release,
    source_sha: node.source_sha,
    build_id: node.build_id,
    marker: node.marker,
    health_status: node.health_status,
  };
}

function featureProjection(cell) {
  if (!cell) return null;
  return { allowed_operations: [...cell.allowed_operations].sort(), denials: [...cell.denials].sort(compareDenial) };
}

function setDifferenceCount(left, right) {
  const leftSet = new Set(array(left));
  const rightSet = new Set(array(right));
  return [...leftSet].filter((value) => !rightSet.has(value)).length + [...rightSet].filter((value) => !leftSet.has(value)).length;
}

function denialDifferenceCount(left, right) {
  return setDifferenceCount(array(left).map((entry) => `${entry.operation}\0${entry.reason}`), array(right).map((entry) => `${entry.operation}\0${entry.reason}`));
}

function denialOperationDifferenceCount(left, right) {
  return setDifferenceCount(array(left).map((entry) => entry.operation), array(right).map((entry) => entry.operation));
}

function denialReasonDifferenceCount(left, right) {
  const expected = new Map(array(right).map((entry) => [entry.operation, entry.reason]));
  return array(left).filter((entry) => expected.has(entry.operation) && expected.get(entry.operation) !== entry.reason).length;
}

function multisetDifference(left, right) {
  const counts = new Map();
  for (const value of left) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (const value of right) counts.set(value, (counts.get(value) ?? 0) - 1);
  return [...counts.values()].reduce((total, count) => total + Math.abs(count), 0);
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

function inventoryDigest(files) {
  return sha256(Buffer.from([...files].sort((left, right) => left.path.localeCompare(right.path)).map((entry) => `${entry.path}\0${entry.size_bytes}\0${entry.sha256}\n`).join('')));
}

function parseProperties(value) {
  return Object.fromEntries(value.trim().split('\n').filter(Boolean).map((line) => {
    const index = line.indexOf('=');
    if (index < 1) throw new Error(`E10_PATCH_PROPERTY_INVALID:${line}`);
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

function emptyReconciliation() {
  return {
    metrics: {
      candidate_build_count: null,
      candidate_artifact_identity_count: null,
      node_specific_source_and_build_count: null,
      hosted_host_switch_count: null,
      hosted_per_node_action_count: null,
      pointer_mismatch_count: null,
      feature_cell_completeness_mismatch_count: null,
      expected_declaration_difference_count: null,
      observed_capability_symmetric_difference_count: null,
      denial_reason_mismatch_count: null,
      rollback_non_target_change_count: null,
    },
    violations: [],
  };
}

function threshold(thresholdId, expected, actual) {
  return Object.freeze({ threshold_id: thresholdId, expected, actual, met: actual === expected });
}

function requireValue(value, label, output) {
  if (value === undefined || value === null || value === '') output.push(label);
}

function requireObject(value, label, output) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) output.push(label);
}

function requireArray(value, label, output, nonempty) {
  if (!Array.isArray(value) || (nonempty && value.length === 0)) output.push(label);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function validSha(value) {
  return /^sha256:[a-f0-9]{64}$/.test(value ?? '');
}

function requiredOption(name) {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`E10_ORACLE_OPTION_REQUIRED:${name}`);
  return value;
}

function readJson(path) {
  return readFile(path, 'utf8').then(JSON.parse);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function capture(command, args) {
  return execute(command, args).then((result) => {
    if (result.exitCode !== 0) throw new Error(`E10_ORACLE_COMMAND_FAILED:${command}:${result.stderr}`);
    return result.stdout;
  });
}

async function execute(command, args, input) {
  return await new Promise((resolveExecution, reject) => {
    const child = spawn(command, args, { cwd: repositoryRoot, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => resolveExecution({ exitCode: code ?? 1, stdout, stderr }));
    child.stdin.end(input ?? '');
  });
}
