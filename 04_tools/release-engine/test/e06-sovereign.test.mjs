import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { E06_EVIDENCE_FILENAMES, evaluateE06Facts } from '../src/e06-sovereign.mjs';

const passingFacts = Object.freeze({
  artifactBIdentityCount: 1,
  nodeSpecificSourceCount: 0,
  eligibleNodes: ['s-a', 's-b', 's-c'],
  activationTargets: ['s-b'],
  rollbackTargets: ['s-b'],
  canarySequence: ['A', 'B', 'A'],
  controlChangeCount: 0,
  allNodesHealthyDuringCanary: true,
  rollbackHealthy: true,
  rollbackRelease: 'A',
  historyChangeCount: 0,
});

test('E06 exhaustive boundary passes only the single-node A-to-B-to-A topology', () => {
  const decision = evaluateE06Facts(passingFacts);
  assert.equal(decision.result, 'PASS');
  assert.deepEqual(decision.failureReasons, []);
  assert(Object.values(decision.checks).every(Boolean));
});

test('E06 exhaustive boundary fails every prohibited outcome', () => {
  const failures = [
    ['artifactBIdentityCount', 2, 'one_shared_candidate_b_identity'],
    ['nodeSpecificSourceCount', 1, 'no_node_specific_source_or_build'],
    ['activationTargets', ['s-a', 's-b'], 'activation_target_is_only_s_b'],
    ['rollbackTargets', ['s-a', 's-b', 's-c'], 'rollback_target_is_only_s_b'],
    ['canarySequence', ['A', 'B', 'B'], 'canary_sequence_is_a_b_a'],
    ['controlChangeCount', 1, 's_a_and_s_c_unchanged'],
    ['allNodesHealthyDuringCanary', false, 'no_simultaneous_upgrade_required'],
    ['rollbackHealthy', false, 's_b_healthy_after_rollback'],
    ['historyChangeCount', 1, 'four_flow_history_unchanged'],
  ];
  for (const [field, value, expectedReason] of failures) {
    const decision = evaluateE06Facts({ ...passingFacts, [field]: value });
    assert.equal(decision.result, 'FAIL', field);
    assert(decision.failureReasons.includes(expectedReason), field);
  }
});

test('E06 publishes the six contract evidence filenames', () => {
  assert.deepEqual(E06_EVIDENCE_FILENAMES, [
    'sovereign-artifact-manifest.json',
    'sovereign-pointer-timeline.json',
    'sovereign-canary-activation-receipt.json',
    'sovereign-single-node-rollback-receipt.json',
    'sovereign-nontarget-diff.json',
    'sovereign-four-flow-history-digest.json',
  ]);
});

test('committed E06 receipt proves one real canary transition and zero non-target or history changes', async () => {
  const evidenceRoot = new URL('../../../05_docs_ziliao/docs_wendang/architecture/evidence/', import.meta.url);
  const detailRoot = new URL('e06-sovereign-single-node-rollout/', evidenceRoot);
  const summary = await readJson(new URL('SFL-E06-Sovereign单节点渐进发布与回滚验收-2026-09-13.json', evidenceRoot));
  const artifacts = await readJson(new URL('sovereign-artifact-manifest.json', detailRoot));
  const timeline = await readJson(new URL('sovereign-pointer-timeline.json', detailRoot));
  const activation = await readJson(new URL('sovereign-canary-activation-receipt.json', detailRoot));
  const rollback = await readJson(new URL('sovereign-single-node-rollback-receipt.json', detailRoot));
  const nonTarget = await readJson(new URL('sovereign-nontarget-diff.json', detailRoot));
  const histories = await readJson(new URL('sovereign-four-flow-history-digest.json', detailRoot));

  assert.equal(summary.result, 'PASS');
  assert(Object.values(summary.checks).every(Boolean));
  assert.equal(artifacts.build_contract.candidate_b_artifact_identity_count, 1);
  assert.equal(artifacts.build_contract.node_specific_source_count, 0);
  assert.match(artifacts.artifacts.B.archive_digest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(activation.target_manifest.selected_nodes, ['s-b']);
  assert.deepEqual(rollback.target_manifest.selected_nodes, ['s-b']);
  assert.equal(rollback.health.status, 'ready');
  assert.equal(rollback.health.release, 'A');
  assert.equal(nonTarget.total_change_count, 0);
  assert.equal(histories.total_change_count, 0);

  const events = Object.fromEntries(timeline.events.map((event) => [event.phase, event.state.nodes]));
  assert.deepEqual([
    events.before_canary_activation['s-b'].health.release,
    events.after_canary_activation['s-b'].health.release,
    events.after_single_node_rollback['s-b'].health.release,
  ], ['A', 'B', 'A']);
  assert.notEqual(events.before_canary_activation['s-b'].process.main_pid,
    events.after_canary_activation['s-b'].process.main_pid);
  assert.notEqual(events.after_canary_activation['s-b'].process.main_pid,
    events.after_single_node_rollback['s-b'].process.main_pid);
  for (const node of ['s-a', 's-c']) {
    assert.deepEqual(events.before_canary_activation[node], events.after_canary_activation[node]);
    assert.deepEqual(events.before_canary_activation[node], events.after_single_node_rollback[node]);
  }
});

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
