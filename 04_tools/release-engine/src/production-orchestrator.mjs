import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

import { DeliveryError, invariant, redactDeliveryDetails } from './errors.mjs';
import { evaluateReleaseBundle } from './delivery-reconcile.mjs';
import { isTransientNetworkFailure } from './retry.mjs';
import { digest } from './stable.mjs';

const execFile = promisify(execFileCallback);
const SHA = /^[a-f0-9]{40}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const CANONICAL = '/Users/Ethan/.codex/bin/zdt-delivery';

export const RELEASE_REQUEST_SCHEMA = 'ai.delivery.production-release-request.v1';
export const ORCHESTRATION_SCHEMA = 'ai.delivery.production-orchestration.v1';
export const ORCHESTRATION_STATES = Object.freeze([
  'REQUESTED', 'READINESS', 'PREPARING', 'RESUMING', 'SEALED', 'BUNDLE_READY', 'DEPLOYING', 'HEALTHY', 'FAILED_RETRYABLE', 'FAILED_BLOCKED',
]);

export async function createProductionReleaseRequest(spec, dependencies = {}) {
  const sourceSha = exact(spec.sourceSha, SHA, 'RELEASE_SOURCE_SHA_INVALID');
  const resolveControl = dependencies.resolveLatestControlSha ?? defaultResolveLatestControlSha;
  const controlPlaneSha = exact(await resolveControl(), SHA, 'RELEASE_CONTROL_SHA_INVALID');
  const components = normalizeComponents(spec.requiredComponents);
  assertDependencyGraph(components);
  const requestedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const unsigned = { schema: RELEASE_REQUEST_SCHEMA, project: required(spec.project, 'RELEASE_PROJECT_REQUIRED'),
    sourceSha, controlPlaneSha, requiredComponents: components, triggerActor: required(spec.triggerActor, 'RELEASE_TRIGGER_ACTOR_REQUIRED'),
    requestedAt, retryPolicy: normalizeRetryPolicy(spec.retryPolicy), rolloutPolicy: normalizeRolloutPolicy(spec.rolloutPolicy),
    expectedComponentClosure: components.map(({ componentId, target, physicalNode, dependsOn }) => ({ componentId, target, physicalNode, dependsOn })) };
  const idempotencyKey = `sha256:${digest({ project: unsigned.project, sourceSha, controlPlaneSha,
    closure: unsigned.expectedComponentClosure, retryPolicy: unsigned.retryPolicy, rolloutPolicy: unsigned.rolloutPolicy }).slice(7)}`;
  return Object.freeze({ ...unsigned, requestId: spec.requestId ?? `release-${idempotencyKey.slice(7, 23)}`, idempotencyKey });
}

export async function orchestrateProductionClosure(request, dependencies = {}) {
  validateRequest(request);
  const now = dependencies.now ?? (() => new Date());
  const timeline = [];
  const components = new Map();
  const canonical = dependencies.canonical ?? canonicalDeliveryAdapter();
  const stateStore = requiredDependency(dependencies.stateStore, 'ORCHESTRATION_STATE_STORE_REQUIRED');
  const doctor = requiredDependency(dependencies.doctor, 'ORCHESTRATION_DOCTOR_REQUIRED');
  const reconcile = requiredDependency(dependencies.reconcileComponent, 'ORCHESTRATION_RECONCILE_REQUIRED');
  const start = now();
  event(timeline, 'REQUESTED', start, { requestId: request.requestId, idempotencyKey: request.idempotencyKey });

  const claim = await stateStore.claimRequest(request.idempotencyKey, request);
  invariant(claim?.requestId === request.requestId || claim?.request?.idempotencyKey === request.idempotencyKey,
    'ORCHESTRATION_IDEMPOTENCY_CONFLICT', 'Idempotency key is already bound to a different release request');
  const completed = await stateStore.getCompleted?.(request.idempotencyKey);
  if (completed?.state === 'HEALTHY') return summary(request, 'HEALTHY', timeline, completed.components ?? [], {
    reused: true, action: 'NOOP_ALREADY_HEALTHY', requiresHuman: false, startedAt: start, now,
  });

  event(timeline, 'READINESS', now(), {});
  const readiness = await doctor(request);
  if (readiness?.readyForPrepare !== true) return blocked(request, timeline, [], readiness?.nextSafeAction ?? 'repair-readiness-and-replay-same-request', now);

  const pending = new Map(request.requiredComponents.map((component) => [component.componentId, component]));
  const sealed = new Set();
  while (pending.size > 0) {
    const ready = [...pending.values()].filter((component) => component.dependsOn.every((dependency) => sealed.has(dependency)));
    if (ready.length === 0) return blocked(request, timeline, [...components.values()], 'repair-component-dependency-graph', now);
    event(timeline, components.size === 0 ? 'PREPARING' : 'RESUMING', now(), { components: ready.map(({ componentId }) => componentId) });
    const outcomes = await Promise.all(ready.map((component) => progressComponent(request, component, { ...dependencies, canonical, reconcile, now })));
    for (let index = 0; index < ready.length; index += 1) {
      const component = ready[index]; const outcome = outcomes[index];
      components.set(component.componentId, outcome); pending.delete(component.componentId);
      if (outcome.state === 'SEALED') sealed.add(component.componentId);
    }
    if (outcomes.some((outcome) => outcome.state === 'FAILED_BLOCKED')) {
      const independent = [...pending.values()].filter((component) => component.dependsOn.every((dependency) => sealed.has(dependency)));
      if (independent.length === 0) return blocked(request, timeline, [...components.values()], 'repair-blocked-component-and-replay-same-request', now);
    }
  }

  if ([...components.values()].some((value) => value.state === 'FAILED_RETRYABLE')) {
    event(timeline, 'FAILED_RETRYABLE', now(), {});
    return summary(request, 'FAILED_RETRYABLE', timeline, [...components.values()], { reused: false,
      action: 'REPLAY_SAME_REQUEST_FROM_CHECKPOINT', requiresHuman: true,
      nextSafeAction: 'repair-transient-cause-and-replay-the-same-idempotency-key', startedAt: start, now });
  }

  event(timeline, 'SEALED', now(), { sealed: [...sealed] });
  const componentStates = [...components.values()].map((value) => ({ componentId: value.componentId, sourceSha: value.sourceSha,
    controlPlaneSha: value.controlPlaneSha, target: value.target, physicalNode: value.physicalNode, artifactDigest: value.artifactDigest,
    state: value.state, exactResource: value.exactResource, provenanceDigest: value.provenanceDigest }));
  const requiredComponents = request.requiredComponents.map((value) => ({ componentId: value.componentId, target: value.target,
    physicalNode: value.physicalNode, artifactDigest: components.get(value.componentId)?.artifactDigest,
    provenanceDigest: components.get(value.componentId)?.provenanceDigest, exactResource: components.get(value.componentId)?.exactResource }));
  const gate = (dependencies.evaluateBundle ?? evaluateReleaseBundle)({ sourceSha: request.sourceSha, controlPlaneSha: request.controlPlaneSha,
    requiredComponents, componentStates });
  if (!gate.allowDeploy) return blocked(request, timeline, componentStates, gate.nextSafeAction, now, gate);
  const gateReceipt = Object.freeze({ ...gate, requestId: request.requestId, idempotencyKey: request.idempotencyKey, createdAt: now().toISOString() });
  await stateStore.putImmutable('bundle-gate', request.idempotencyKey, gateReceipt);
  event(timeline, 'BUNDLE_READY', now(), { gateDigest: digest(gateReceipt) });

  const lease = await stateStore.acquireReleaseWriter(request.idempotencyKey, request.requestId);
  if (!lease?.owner) return blocked(request, timeline, componentStates, 'wait-for-active-release-writer-or-review-owner-conflict', now, gate, 'OWNER_CONFLICT');
  const existingDeploy = await stateStore.getDeployReceipt?.(request.idempotencyKey);
  if (existingDeploy) return finishHealthy(request, timeline, componentStates, existingDeploy, stateStore, now, true);

  const deployStarted = now();
  event(timeline, 'DEPLOYING', deployStarted, {});
  const sealAt = Math.max(...componentStates.map((item) => Date.parse(components.get(item.componentId).sealedAt)));
  const sealToDeployGapMs = deployStarted.getTime() - sealAt;
  invariant(sealToDeployGapMs <= request.rolloutPolicy.maxSealToDeployGapMs, 'SEAL_TO_DEPLOY_GAP_EXCEEDED',
    'Seal-to-Deploy orchestration gap exceeded the requested local contract', { sealToDeployGapMs, localEvidenceOnly: true });
  const deploymentEvidence = [];
  try {
    for (const wave of rolloutWaves(request.requiredComponents)) {
      const waveResults = await Promise.all(wave.map(async (component) => {
        const value = components.get(component.componentId);
        const deployed = await executeRecoverable(() => canonical.deploy(component.target, request.sourceSha, component.physicalNode, request.controlPlaneSha),
          { ...request.retryPolicy, exactResource: value.exactResource, reconcile: () => reconcile(request, component), dependencies });
        const health = await dependencies.healthCheck(request, component, deployed);
        invariant(health?.healthy === true, 'DEPLOY_HEALTH_CHECK_FAILED', 'Deployment health contract failed', {
          componentId: component.componentId, nextSafeAction: 'stop-later-waves-and-use-existing-rollback-evidence',
        });
        return Object.freeze({ componentId: component.componentId, canonical: deployed, health, current: health.current,
          previous: health.previous, rollbackEvidence: health.rollbackEvidence });
      }));
      deploymentEvidence.push(...waveResults);
    }
  } catch (error) {
    return blocked(request, timeline, componentStates, error?.details?.nextSafeAction ?? 'review-deploy-health-and-rollback-evidence', now, gate,
      error?.code ?? 'DEPLOYMENT_FAILED');
  }
  const deployReceipt = Object.freeze({ schema: 'ai.delivery.bundle-deploy-receipt.v1', requestId: request.requestId,
    idempotencyKey: request.idempotencyKey, sourceSha: request.sourceSha, controlPlaneSha: request.controlPlaneSha,
    bundleGateDigest: digest(gateReceipt), components: deploymentEvidence, sealToDeployGapMs, localEvidenceOnly: true, completedAt: now().toISOString() });
  await stateStore.putImmutable('deploy-receipt', request.idempotencyKey, deployReceipt);
  return finishHealthy(request, timeline, componentStates, deployReceipt, stateStore, now, false);
}

async function progressComponent(request, component, context) {
  let state = await context.reconcile(request, component);
  if (state.action === 'NOOP_ALREADY_SEALED') return componentResult(component, state);
  if (state.action.startsWith('STOP_')) return componentResult(component, state);
  const prepare = () => context.canonical.prepare(component.target, request.sourceSha, component.physicalNode, request.controlPlaneSha);
  try {
    await executeRecoverable(prepare, { ...request.retryPolicy, exactResource: state.exactResource,
      reconcile: () => context.reconcile(request, component), dependencies: context });
  } catch (error) {
    state = await context.reconcile(request, component, error);
    if (error?.code === 'ORCHESTRATION_RETRY_EXHAUSTED') state = { ...state, state: 'FAILED_RETRYABLE', action: 'STOP_RETRY_BUDGET_EXHAUSTED',
      retryable: true, resumeAllowed: true, resumeFrom: state.resumeFrom ?? state.checkpoint ?? 'UPLOAD',
      nextSafeAction: error.details?.nextSafeAction ?? 'repair-cause-and-replay-same-request' };
    return componentResult(component, state);
  }
  state = await context.reconcile(request, component);
  if (state.state !== 'SEALED' || state.action !== 'NOOP_ALREADY_SEALED') return componentResult(component, state);
  return componentResult(component, state);
}

async function executeRecoverable(operation, options) {
  const budget = Number(options.budget ?? 3); const baseDelayMs = Number(options.baseDelayMs ?? 250);
  const sleep = options.dependencies.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const random = options.dependencies.random ?? Math.random;
  let lastError;
  for (let attempt = 1; attempt <= budget; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      lastError = error;
      const readback = await options.reconcile(error);
      if (readback?.action === 'NOOP_ALREADY_SEALED') return { recoveredByExactReadback: true, attempt };
      if (readback?.action === 'STOP_PERMISSION_DENIED' || readback?.action === 'STOP_SECURITY_MISMATCH' || readback?.action === 'STOP_OWNER_CONFLICT') throw error;
      if (error?.code === 'STS_CREDENTIAL_EXPIRED') await options.dependencies.refreshCredential?.({ attempt, exactResource: options.exactResource });
      else if (!isTransientNetworkFailure(error) && error?.code !== 'FINAL_SEAL_WRITE_OUTCOME_UNKNOWN') throw error;
      if (attempt === budget) break;
      const base = baseDelayMs * (2 ** (attempt - 1));
      await sleep(Math.round(base + base * 0.25 * random()));
    }
  }
  throw new DeliveryError('ORCHESTRATION_RETRY_EXHAUSTED', 'Recoverable operation exhausted its retry budget', {
    retryable: true, attempts: budget, exactResource: options.exactResource, causeCode: lastError?.code,
    nextSafeAction: 'repair-cause-and-replay-the-same-idempotency-key-from-checkpoint',
  });
}

export function canonicalDeliveryAdapter(options = {}) {
  const run = options.execFile ?? execFile;
  const binary = options.binary ?? CANONICAL;
  return Object.freeze({
    prepare: (target, sourceSha, physicalNode, controlPlaneSha) => invoke('prepare', target, sourceSha, physicalNode, controlPlaneSha),
    deploy: (target, sourceSha, physicalNode, controlPlaneSha) => invoke('deploy', target, sourceSha, physicalNode, controlPlaneSha),
  });
  async function invoke(operation, target, sourceSha, physicalNode, expectedControlSha) {
    const { stdout = '' } = await run(binary, [operation, target, sourceSha, physicalNode]);
    const observed = String(stdout).match(/Delivery control:\s*([a-f0-9]{40})/)?.[1];
    invariant(observed === expectedControlSha, 'CANONICAL_CONTROL_SHA_DRIFT', 'Canonical command resolved a different release control-plane SHA', {
      expectedControlSha, observedControlSha: observed ?? null, nextSafeAction: 'create-a-new-release-request-against-latest-origin-zdt-next',
    });
    return Object.freeze({ operation, target, sourceSha, physicalNode, controlPlaneSha: observed, stdout: 'canonical-output-redacted' });
  }
}

function finishHealthy(request, timeline, components, deployReceipt, stateStore, now, reused) {
  event(timeline, 'HEALTHY', now(), { reused });
  const result = summary(request, 'HEALTHY', timeline, components, { reused, action: reused ? 'NOOP_ALREADY_DEPLOYED' : 'DEPLOYED_AND_HEALTHY',
    requiresHuman: false, deployReceipt, startedAt: new Date(timeline[0].at), now });
  return Promise.resolve(stateStore.putImmutable('orchestration-complete', request.idempotencyKey, result)).then(() => result);
}
function blocked(request, timeline, components, nextSafeAction, now, gate = null, failureClass = 'ORCHESTRATION_BLOCKED') {
  event(timeline, 'FAILED_BLOCKED', now(), { failureClass });
  return summary(request, 'FAILED_BLOCKED', timeline, components, { reused: false, action: 'STOP_REQUIRES_HUMAN', requiresHuman: true,
    nextSafeAction, gate, startedAt: new Date(timeline[0].at), now });
}
function summary(request, state, timeline, components, options) {
  const completedAt = options.now().toISOString(); const startedAt = options.startedAt ?? new Date(timeline[0].at);
  return Object.freeze(redactDeliveryDetails({ schema: ORCHESTRATION_SCHEMA, requestId: request.requestId, idempotencyKey: request.idempotencyKey,
    sourceSha: request.sourceSha, controlPlaneSha: request.controlPlaneSha, state, action: options.action,
    components, timeline, requiresHuman: options.requiresHuman, nextSafeAction: options.nextSafeAction ?? null,
    reused: options.reused, deployReceipt: options.deployReceipt ?? null, completedAt,
    durationMs: new Date(completedAt).getTime() - startedAt.getTime(), productionP95Claimed: false }, request.secretValues));
}
function componentResult(component, state) { return Object.freeze({ componentId: component.componentId, target: component.target,
  physicalNode: component.physicalNode, ...state, sealedAt: state.timestamp }); }
function event(timeline, state, at, evidence) { invariant(ORCHESTRATION_STATES.includes(state), 'ORCHESTRATION_STATE_INVALID', state); timeline.push(Object.freeze({ state, at: at.toISOString(), evidence })); }
function rolloutWaves(components) { const pending = new Map(components.map((value) => [value.componentId, value])); const done = new Set(); const waves = [];
  while (pending.size) { const wave = [...pending.values()].filter((value) => value.dependsOn.every((id) => done.has(id))); invariant(wave.length > 0, 'RELEASE_DEPENDENCY_CYCLE', 'Component graph contains a cycle'); waves.push(wave); for (const item of wave) { pending.delete(item.componentId); done.add(item.componentId); } } return waves; }
function normalizeComponents(values) { invariant(Array.isArray(values) && values.length > 0, 'RELEASE_COMPONENTS_REQUIRED', 'Release requires components'); return Object.freeze(values.map((value) => Object.freeze({ componentId: exact(value.componentId, NAME, 'RELEASE_COMPONENT_ID_INVALID'), target: exact(value.target, NAME, 'RELEASE_TARGET_INVALID'), physicalNode: exact(value.physicalNode, NAME, 'RELEASE_NODE_INVALID'), dependsOn: Object.freeze([...(value.dependsOn ?? [])]) }))); }
function assertDependencyGraph(components) { const ids = new Set(components.map(({ componentId }) => componentId)); invariant(ids.size === components.length, 'RELEASE_COMPONENT_DUPLICATE', 'Component IDs must be unique'); for (const component of components) for (const dependency of component.dependsOn) invariant(ids.has(dependency) && dependency !== component.componentId, 'RELEASE_DEPENDENCY_INVALID', 'Unknown or self dependency'); rolloutWaves(components); }
function normalizeRetryPolicy(value = {}) { return Object.freeze({ budget: integer(value.budget ?? 3, 1, 5, 'RELEASE_RETRY_BUDGET_INVALID'), baseDelayMs: integer(value.baseDelayMs ?? 250, 0, 60_000, 'RELEASE_RETRY_DELAY_INVALID') }); }
function normalizeRolloutPolicy(value = {}) { return Object.freeze({ maxSealToDeployGapMs: integer(value.maxSealToDeployGapMs ?? 10_000, 1, 60_000, 'RELEASE_GAP_INVALID') }); }
function validateRequest(value) { invariant(value?.schema === RELEASE_REQUEST_SCHEMA && SHA.test(value.sourceSha) && SHA.test(value.controlPlaneSha)
  && typeof value.idempotencyKey === 'string', 'RELEASE_REQUEST_INVALID', 'Release request contract is invalid'); assertDependencyGraph(value.requiredComponents); }
async function defaultResolveLatestControlSha() { await execFile('git', ['fetch', 'origin', 'zdt-next', '--quiet']); const { stdout } = await execFile('git', ['rev-parse', 'origin/zdt-next']); return stdout.trim(); }
function requiredDependency(value, code) { invariant(typeof value === 'function' || (value && typeof value === 'object'), code, code); return value; }
function integer(value, min, max, code) { invariant(Number.isInteger(value) && value >= min && value <= max, code, code); return value; }
function exact(value, pattern, code) { invariant(typeof value === 'string' && pattern.test(value), code, code); return value; }
function required(value, code) { invariant(typeof value === 'string' && value.length > 0, code, code); return value; }
