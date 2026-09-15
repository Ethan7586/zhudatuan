import { createHash } from 'node:crypto';

import { DeliveryError, invariant } from './errors.mjs';
import { prettyStableJson } from './stable.mjs';

export const RUNNER_REQUEST_SCHEMA = 'ai.delivery.runner-request.v1';
export const RUNNER_LEASE_SCHEMA = 'ai.delivery.runner-lease.v1';
export const STANDARD_GITHUB_RUNNER = 'ubuntu-24.04';
export const ALIYUN_BUILD_HOST = 'aliyun-ecs-202';

const SHA = /^[a-f0-9]{40}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const SLOT_LABELS = Object.freeze(['zdt-aliyun-build-1', 'zdt-aliyun-build-2']);

export function createRunnerRequest(input) {
  const sourceSha = exactSha(input.sourceSha, 'RUNNER_REQUEST_SOURCE_SHA_INVALID');
  const releaseTarget = exactName(input.releaseTarget, 'RUNNER_REQUEST_TARGET_INVALID');
  const physicalNode = exactName(input.physicalNode, 'RUNNER_REQUEST_NODE_INVALID');
  const controlPlaneSha = exactSha(input.controlPlaneSha, 'RUNNER_REQUEST_CONTROL_SHA_INVALID');
  const serialization = `zdt-runner-request/v1\nsource_sha=${sourceSha}\nrelease_target=${releaseTarget}\nphysical_node=${physicalNode}\ncontrol_plane_sha=${controlPlaneSha}\n`;
  return Object.freeze({
    schema: RUNNER_REQUEST_SCHEMA, source_sha: sourceSha, release_target: releaseTarget,
    physical_node: physicalNode, control_plane_sha: controlPlaneSha,
    request_id: createHash('sha256').update(serialization).digest('hex'), serialization,
  });
}

export async function routeBuildRequest(client, input, dependencies = {}) {
  assertClient(client);
  const request = createRunnerRequest(input);
  const now = dependencies.now ?? (() => new Date());
  const leaseMs = Number(input.leaseMs ?? 180_000);
  invariant(Number.isSafeInteger(leaseMs) && leaseMs >= 30_000 && leaseMs <= 900_000,
    'RUNNER_LEASE_DURATION_INVALID', 'Runner routing lease must be between 30 seconds and 15 minutes');
  const existingSealStage = input.sealStage ?? await findExistingSealStage(client, input.project, request);
  if (['UPLOADED', 'VALIDATED', 'SEALED'].includes(existingSealStage)) {
    return result(request, { phase: existingSealStage, reusedExistingTask: true, shouldBuild: false, retryCount: Number(input.retryCount ?? 0) });
  }

  const root = routingRoot(input.project, request);
  const leases = await readNumbered(client, `${root}/leases/`);
  const latest = leases.at(-1);
  if (latest && !(await isAbandoned(client, root, latest.generation))) {
    const started = await optionalJson(client, `${root}/started/${number(latest.generation)}.json`);
    const finished = await optionalJson(client, `${root}/finished/${number(latest.generation)}.json`);
    if (started && !finished) return result(request, { ...latest, phase: 'BUILDING', reusedExistingTask: true, shouldBuild: false });
    if (finished) return result(request, { ...latest, phase: finished.status, reusedExistingTask: true, shouldBuild: false });
    if (Date.parse(latest.expires_at) > now().getTime()) return result(request, { ...latest, phase: 'WAITING_EXISTING_TASK', reusedExistingTask: true, shouldBuild: false });
  }

  let generation = (latest?.generation ?? 0) + 1;
  const runners = normalizeRunners(input.runners ?? []);
  const requestedClass = input.requestedRunnerClass ?? 'auto';
  invariant(['auto', 'aliyun', 'github'].includes(requestedClass), 'RUNNER_CLASS_INVALID', 'Runner class must be auto, aliyun or github');
  const eligible = requestedClass === 'github' ? [] : runners.filter((runner) => runner.status === 'online' && runner.busy === false);
  let overflowReason = requestedClass === 'github' ? 'explicit-github-standard' : null;

  for (const runner of eligible) {
    const lease = leaseValue(request, generation, now(), leaseMs, 'aliyun', runner.name, runner.slotLabel, overflowReason, input.retryCount);
    const requestClaim = await claimRequestLease(client, `${root}/leases/${number(generation)}.json`, lease);
    if (!requestClaim.owner) return result(request, { ...requestClaim.lease, phase: 'WAITING_EXISTING_TASK', reusedExistingTask: true, shouldBuild: false });
    const claimed = await claimSlot(client, input.project, request, lease, now);
    if (claimed) {
      const stillAvailable = dependencies.verifyRunnerAvailable ? await dependencies.verifyRunnerAvailable(runner) : true;
      if (stillAvailable) return result(request, { ...lease, phase: 'ROUTED', reusedExistingTask: false, shouldBuild: true });
      await putJson(client, `${root}/abandoned/${number(generation)}.json`, failure('RUNNER_OFFLINE_BEFORE_CLAIM', 'runner-selection', true, 1, 'select-another-runner'));
      generation += 1;
      overflowReason = 'aliyun-runner-offline-before-claim';
      continue;
    }
    await putJson(client, `${root}/abandoned/${number(generation)}.json`, failure('RUNNER_SLOT_LEASE_CONFLICT', 'runner-selection', true, 1, 'select-another-runner'));
    generation += 1;
    overflowReason = 'aliyun-capacity-leased';
  }

  invariant(requestedClass !== 'aliyun', 'ALIYUN_RUNNER_CAPACITY_UNAVAILABLE', 'No Aliyun Build slot can atomically accept this request', {
    stage: 'runner-selection', retryable: true, attempts: 1, nextSafeAction: 'retry-routing-after-lease-expiry',
  });
  overflowReason ??= runners.length === 0 ? 'aliyun-runners-offline-or-missing' : 'aliyun-slots-busy-or-offline';
  const lease = leaseValue(request, generation, now(), leaseMs, 'github', null, null, overflowReason, input.retryCount);
  const requestClaim = await claimRequestLease(client, `${root}/leases/${number(generation)}.json`, lease);
  if (!requestClaim.owner) return result(request, { ...requestClaim.lease, phase: 'WAITING_EXISTING_TASK', reusedExistingTask: true, shouldBuild: false });
  return result(request, { ...lease, phase: 'ROUTED', reusedExistingTask: false, shouldBuild: true });
}

export async function markRunnerStarted(client, input) {
  const request = createRunnerRequest(input);
  const root = routingRoot(input.project, request);
  const generation = positiveInteger(input.leaseGeneration, 'RUNNER_LEASE_GENERATION_INVALID');
  const leases = await readNumbered(client, `${root}/leases/`);
  const lease = leases.find((item) => item.generation === generation);
  invariant(lease, 'RUNNER_LEASE_MISSING', 'Runner cannot start without its exact routing lease');
  invariant(!(await isAbandoned(client, root, generation)), 'RUNNER_LEASE_ABANDONED', 'Abandoned Runner lease cannot start');
  if (lease.selected_runner_class === 'aliyun') {
    invariant(lease.selected_runner_name === input.selectedRunnerName, 'RUNNER_CLAIM_NAME_MISMATCH', 'A different Aliyun logical slot claimed the routed job');
  }
  const value = { schema: 'ai.delivery.runner-started.v1', request_id: request.request_id, generation,
    selected_runner_class: lease.selected_runner_class, selected_runner_name: exactText(input.selectedRunnerName, 'RUNNER_NAME_REQUIRED'),
    started_at: (input.now ?? new Date()).toISOString() };
  await putJson(client, `${root}/started/${number(generation)}.json`, value);
  return result(request, { ...lease, selected_runner_name: value.selected_runner_name, phase: 'BUILDING', reusedExistingTask: false, shouldBuild: true });
}

export async function markRunnerFinished(client, input) {
  const request = createRunnerRequest(input);
  const root = routingRoot(input.project, request);
  const generation = positiveInteger(input.leaseGeneration, 'RUNNER_LEASE_GENERATION_INVALID');
  invariant(await optionalJson(client, `${root}/started/${number(generation)}.json`), 'RUNNER_START_MISSING', 'Runner cannot finish before it starts');
  const status = input.status === 'success' ? 'COMPLETED' : 'BUILD_FAILED';
  const value = { schema: 'ai.delivery.runner-finished.v1', request_id: request.request_id, generation, status,
    failure: status === 'BUILD_FAILED' ? failure('BUILD_FAILED', 'build', false, 1, 'inspect-build-evidence') : null,
    finished_at: (input.now ?? new Date()).toISOString() };
  await putJson(client, `${root}/finished/${number(generation)}.json`, value);
  return value;
}

export function failure(code, stage, retryable, attempts, nextSafeAction) {
  return Object.freeze({ code, stage, retryable: retryable === true, attempts, next_safe_action: nextSafeAction });
}

async function claimSlot(client, project, request, lease, now) {
  const prefix = `${exactName(project, 'RUNNER_PROJECT_INVALID')}/runner-routing/v1/slots/${lease.slot_label}/claims/`;
  const claims = await readNumbered(client, prefix);
  const latest = claims.at(-1);
  if (latest && await slotClaimActive(client, project, latest, now)) return false;
  const generation = (latest?.generation ?? 0) + 1;
  const claim = { schema: 'ai.delivery.runner-slot-claim.v1', generation, request_id: request.request_id,
    request_generation: lease.generation, slot_label: lease.slot_label, selected_runner_name: lease.selected_runner_name,
    expires_at: lease.expires_at };
  try {
    const written = await putJson(client, `${prefix}${number(generation)}.json`, claim);
    return written.status === 'uploaded';
  } catch (error) {
    if (error instanceof DeliveryError && error.code === 'OSS_IMMUTABLE_OBJECT_CONFLICT') return false;
    throw error;
  }
}

async function claimRequestLease(client, path, lease) {
  try {
    const publication = await putJson(client, path, lease);
    if (publication.status === 'uploaded') return { owner: true, lease };
  } catch (error) {
    if (!(error instanceof DeliveryError) || error.code !== 'OSS_IMMUTABLE_OBJECT_CONFLICT') throw error;
  }
  return { owner: false, lease: JSON.parse((await client.getObject(path)).toString('utf8')) };
}

async function slotClaimActive(client, project, claim, now) {
  const requestPrefix = `${exactName(project, 'RUNNER_PROJECT_INVALID')}/runner-routing/v1/requests/${claim.request_id}`;
  const finished = await optionalJson(client, `${requestPrefix}/finished/${number(claim.request_generation)}.json`);
  if (finished) return false;
  const started = await optionalJson(client, `${requestPrefix}/started/${number(claim.request_generation)}.json`);
  return Boolean(started) || Date.parse(claim.expires_at) > now().getTime();
}

async function findExistingSealStage(client, project, request) {
  const prefix = `${exactName(project, 'RUNNER_PROJECT_INVALID')}/${request.release_target}/${request.source_sha}/seals/v1/${request.physical_node}/`;
  const objects = await client.listPrefix(prefix);
  for (const [suffix, stage] of [['final-seal.json', 'SEALED'], ['candidate-validation.json', 'VALIDATED'], ['uploaded.json', 'UPLOADED']]) {
    for (const object of objects.filter((item) => item.endsWith(suffix))) {
      const value = await optionalJson(client, object);
      if (value?.request_id === request.request_id && value?.key?.control_plane_sha === request.control_plane_sha) return stage;
    }
  }
  return null;
}

function leaseValue(request, generation, date, leaseMs, runnerClass, runnerName, slotLabel, overflowReason, retryCount = 0) {
  const createdAt = date.toISOString();
  return { schema: RUNNER_LEASE_SCHEMA, request, request_id: request.request_id, generation,
    selected_runner_class: runnerClass, selected_runner_name: runnerName, slot_label: slotLabel,
    runner_labels: runnerClass === 'github' ? [STANDARD_GITHUB_RUNNER] : ['self-hosted', 'linux', 'x64', 'zdt-aliyun-build', slotLabel],
    created_at: createdAt, expires_at: new Date(date.getTime() + leaseMs).toISOString(), overflow_reason: overflowReason,
    retry_count: Number(retryCount ?? 0), host: runnerClass === 'aliyun'
      ? { id: ALIYUN_BUILD_HOST, topology: 'same-physical-host-logical-dual-slot' }
      : { id: 'github-hosted', topology: 'standard-hosted-runner' } };
}

function result(request, value) {
  return Object.freeze({ schema: 'ai.delivery.runner-route-result.v1', requestId: request.request_id,
    selectedRunnerClass: value.selected_runner_class ?? null, selectedRunnerName: value.selected_runner_name ?? null,
    runnerLabels: value.runner_labels ?? [], leaseGeneration: value.generation ?? null, leaseExpiresAt: value.expires_at ?? null,
    overflowReason: value.overflow_reason ?? null, retryCount: Number(value.retry_count ?? value.retryCount ?? 0),
    phase: value.phase, reusedExistingTask: value.reusedExistingTask === true, shouldBuild: value.shouldBuild === true,
    host: value.host ?? null });
}

function normalizeRunners(runners) {
  return SLOT_LABELS.map((slotLabel) => runners.find((runner) => Array.isArray(runner.labels) && runner.labels.includes('zdt-aliyun-build') && runner.labels.includes(slotLabel)))
    .filter(Boolean).map((runner) => ({ name: exactText(runner.name, 'RUNNER_NAME_INVALID'), status: runner.status, busy: runner.busy === true,
      slotLabel: runner.labels.find((label) => SLOT_LABELS.includes(label)) }));
}

function routingRoot(project, request) {
  return `${exactName(project, 'RUNNER_PROJECT_INVALID')}/runner-routing/v1/requests/${request.request_id}`;
}

async function readNumbered(client, prefix) {
  const objects = (await client.listPrefix(prefix)).filter((path) => /\/\d{6}\.json$/.test(path)).sort();
  const values = [];
  for (const object of objects) values.push(JSON.parse((await client.getObject(object)).toString('utf8')));
  return values.sort((left, right) => left.generation - right.generation);
}

async function optionalJson(client, path) {
  try { return JSON.parse((await client.getObject(path)).toString('utf8')); }
  catch (error) { if (['OSS_OBJECT_NOT_FOUND', 'OSS_ARTIFACT_NOT_FOUND'].includes(error?.code)) return null; throw error; }
}

async function isAbandoned(client, root, generation) {
  return Boolean(await optionalJson(client, `${root}/abandoned/${number(generation)}.json`));
}

async function putJson(client, path, value) {
  return client.putImmutable(path, Buffer.from(prettyStableJson(value)), 'application/json');
}

function number(value) { return String(value).padStart(6, '0'); }
function positiveInteger(value, code) { const numberValue = Number(value); invariant(Number.isSafeInteger(numberValue) && numberValue > 0, code, 'Expected a positive integer'); return numberValue; }
function exactSha(value, code) { invariant(SHA.test(String(value ?? '')), code, 'Expected one full lowercase Git SHA'); return value; }
function exactName(value, code) { invariant(NAME.test(String(value ?? '')), code, 'Expected a stable identifier'); return value; }
function exactText(value, code) { invariant(typeof value === 'string' && value.trim() !== '', code, 'Expected non-empty text'); return value.trim(); }
function assertClient(client) { invariant(client && ['listPrefix', 'getObject', 'putImmutable'].every((name) => typeof client[name] === 'function'), 'RUNNER_LEASE_STORE_INVALID', 'Runner routing requires the existing immutable OSS store'); }
