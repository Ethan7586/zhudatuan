import { invariant } from './errors.mjs';

export const DELIVERY_TIMELINE_STAGES = Object.freeze([
  'requestCreated', 'readinessDoctor', 'runnerQueueAndRoute', 'checkoutSetupToolchain',
  'dependencyRestoreOrInstall', 'buildA', 'buildB', 'digestCompare', 'upload', 'candidateValidation',
  'finalSealWriteReadback', 'bundleGate', 'sealToDeployGap', 'deploy', 'healthRollbackEvidence', 'userTotalWait',
]);

export const DELIVERY_SPEED_BUDGETS_MS = Object.freeze({
  newSourceToHealthyP95: 180_000,
  sealedToHealthyP95: 60_000,
  sealToDeployP95: 10_000,
  maximumManualTriggers: 1,
});

export function createDeliveryTimeline({ evidenceClass, measurements = {}, metadata = {} }) {
  invariant(['production', 'ci', 'fixture'].includes(evidenceClass), 'TIMELINE_EVIDENCE_CLASS_INVALID',
    'Timeline evidence must be production, ci, or fixture');
  const stages = DELIVERY_TIMELINE_STAGES.map((stage) => {
    const elapsedMs = measurements[stage];
    invariant(elapsedMs === undefined || (Number.isFinite(elapsedMs) && elapsedMs >= 0), 'TIMELINE_DURATION_INVALID',
      `Timeline duration is invalid for ${stage}`);
    return Object.freeze({ stage, elapsedMs: elapsedMs ?? null, observed: elapsedMs !== undefined });
  });
  const observedTotalMs = measurements.userTotalWait ?? stages
    .filter(({ stage }) => stage !== 'userTotalWait')
    .reduce((total, stage) => total + (stage.elapsedMs ?? 0), 0);
  return Object.freeze({ schema: 'ai.delivery.timeline.v1', evidenceClass, budgetsMs: DELIVERY_SPEED_BUDGETS_MS,
    stages, observedTotalMs, productionP95Claimed: false, metadata: Object.freeze({ ...metadata }) });
}
