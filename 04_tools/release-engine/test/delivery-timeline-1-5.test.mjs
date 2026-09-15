import assert from 'node:assert/strict';
import test from 'node:test';

import { createDeliveryTimeline, DELIVERY_TIMELINE_STAGES } from '../src/delivery-timeline.mjs';

test('timeline keeps production, CI and fixture evidence separate and covers every required stage', () => {
  for (const evidenceClass of ['production', 'ci', 'fixture']) {
    const timeline = createDeliveryTimeline({ evidenceClass, measurements: { requestCreated: 1, userTotalWait: 10 } });
    assert.deepEqual(timeline.stages.map(({ stage }) => stage), DELIVERY_TIMELINE_STAGES);
    assert.equal(timeline.productionP95Claimed, false);
    assert.equal(timeline.evidenceClass, evidenceClass);
  }
});

test('fixture speed comparison proves path elimination without claiming production P95', () => {
  const cold = createDeliveryTimeline({ evidenceClass: 'fixture', measurements: {
    runnerQueueAndRoute: 8_000, checkoutSetupToolchain: 12_000, dependencyRestoreOrInstall: 20_000,
    buildA: 35_000, buildB: 35_000, digestCompare: 1_000, upload: 12_000, candidateValidation: 8_000,
    finalSealWriteReadback: 2_000, bundleGate: 500, sealToDeployGap: 1_000, deploy: 18_000,
    healthRollbackEvidence: 8_000, userTotalWait: 160_500,
  } });
  const sealed = createDeliveryTimeline({ evidenceClass: 'fixture', measurements: {
    finalSealWriteReadback: 400, bundleGate: 300, sealToDeployGap: 800, deploy: 18_000,
    healthRollbackEvidence: 8_000, userTotalWait: 27_500,
  } });
  assert.equal(sealed.stages.find(({ stage }) => stage === 'buildA').observed, false);
  assert.ok(sealed.observedTotalMs < cold.observedTotalMs);
  assert.equal(sealed.productionP95Claimed, false);
});
