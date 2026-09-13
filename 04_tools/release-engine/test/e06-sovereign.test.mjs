import assert from 'node:assert/strict';
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
