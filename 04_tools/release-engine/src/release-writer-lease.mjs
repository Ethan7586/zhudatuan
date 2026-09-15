import { createHash } from 'node:crypto';

import { DeliveryError, invariant } from './errors.mjs';
import { prettyStableJson } from './stable.mjs';

export const RELEASE_WRITER_LEASE_SCHEMA = 'ai.delivery.release-writer-lease.v1';
export const RELEASE_WRITER_STATE_SCHEMA = 'ai.delivery.release-writer-state.v1';

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export function createReleaseWriterRequest({ runnerRequestId, operation, sealKey }) {
  const runner = exactRequestId(runnerRequestId, 'RELEASE_WRITER_RUNNER_REQUEST_ID_INVALID');
  invariant(['validate-candidate', 'deploy'].includes(operation), 'RELEASE_WRITER_OPERATION_INVALID', 'Release Writer operation must be validate-candidate or deploy');
  const seal = exactDigest(sealKey, 'RELEASE_WRITER_SEAL_KEY_INVALID');
  const canonical = `zdt-release-writer-request/v1\nrunner_request_id=${runner}\noperation=${operation}\nseal_key=${seal}\n`;
  return Object.freeze({ schema: 'ai.delivery.release-writer-request.v1', request_id: createHash('sha256').update(canonical).digest('hex'), runner_request_id: runner, operation, seal_key: seal });
}

export function createReleaseWriterLeaseStore(client, identity, dependencies = {}) {
  assertClient(client);
  const key = normalizeIdentity(identity);
  const now = dependencies.now ?? (() => {
    invariant(typeof client.authoritativeNow === 'function', 'RELEASE_WRITER_AUTHORITATIVE_TIME_UNAVAILABLE', 'Release Writer Lease requires trusted OSS time');
    return client.authoritativeNow();
  });
  const scheduleInterval = dependencies.setInterval ?? globalThis.setInterval;
  const cancelInterval = dependencies.clearInterval ?? globalThis.clearInterval;
  const paths = writerLeasePaths(key);

  async function read() {
    const leases = await readNumbered(client, paths.leases);
    const lease = leases.at(-1) ?? null;
    if (!lease) return state('EXPIRED', null, { activeWriter: null, writerClass: null, leaseGeneration: null });
    const renewals = await readNumbered(client, `${paths.renewals}${number(lease.lease_generation)}/`);
    const renewal = renewals.at(-1) ?? null;
    const released = await optionalJson(client, `${paths.released}${number(lease.lease_generation)}.json`);
    const expiresAt = renewal?.expires_at ?? lease.expires_at;
    const status = released ? 'RELEASED' : Date.parse(expiresAt) > now().getTime() ? 'ACTIVE' : 'EXPIRED';
    return state(status, released?.released_at ?? renewal?.renewed_at ?? lease.issued_at, {
      activeWriter: lease.writer_identity,
      writerClass: lease.writer_class,
      leaseGeneration: lease.lease_generation,
      leaseIssuedAt: lease.issued_at,
      leaseExpiresAt: expiresAt,
      takeoverReason: lease.takeover_reason,
      takeoverAt: lease.takeover_at,
      originalWriter: lease.original_writer,
      currentRequestId: lease.request_id,
      runnerRequestId: lease.runner_request_id,
      sealKey: lease.seal_key,
      controlPlaneSha: lease.control_plane_sha,
      released,
      lease,
      renewal,
    });
  }

  async function acquire(options) {
    assertWriterRole(options.actorRole);
    const writerIdentity = exactText(options.writerIdentity, 'RELEASE_WRITER_IDENTITY_REQUIRED');
    const writerClass = writerClassValue(options.writerClass);
    const requestId = exactRequestId(options.requestId);
    const runnerRequestId = exactRequestId(options.runnerRequestId, 'RELEASE_WRITER_RUNNER_REQUEST_ID_INVALID');
    const controlPlaneSha = exactSha(options.controlPlaneSha, 'RELEASE_WRITER_CONTROL_SHA_INVALID');
    const sealKey = exactDigest(options.sealKey, 'RELEASE_WRITER_SEAL_KEY_INVALID');
    const leaseSeconds = leaseDuration(options.leaseSeconds ?? 900);
    let current = await read();
    if (current.leaseStatus === 'ACTIVE') {
      if (sameOwner(current.lease, { writerIdentity, writerClass, requestId, runnerRequestId, controlPlaneSha, sealKey })) {
        return outcome(current, { acquired: true, reused: true, actualSwitch: false });
      }
      throw conflict(current, writerIdentity, writerClass);
    }
    if (current.leaseStatus === 'RELEASED' && sameRequest(current.lease, { requestId, runnerRequestId, controlPlaneSha, sealKey })) {
      return outcome(current, { acquired: false, reused: true, completed: true, actualSwitch: false });
    }
    if (current.lease?.writer_class === 'standby' && current.lease.request_id === requestId && writerClass === 'primary') {
      invariant(false, 'RELEASE_WRITER_PRIMARY_RECLAIM_FORBIDDEN', 'Primary cannot reclaim a task already taken over by Standby', conflictDetails(current, writerIdentity, writerClass));
    }
    if (writerClass === 'standby') {
      invariant(options.primaryAvailable === false, 'RELEASE_WRITER_PRIMARY_STATUS_UNPROVEN', 'Standby takeover requires explicit evidence that Primary is unavailable', {
        stage: 'release-writer-acquire', retryable: false, nextSafeAction: 'prove-primary-unavailable-or-wait',
      });
      invariant(current.leaseStatus !== 'ACTIVE', 'RELEASE_WRITER_TAKEOVER_TOO_EARLY', 'Standby cannot take over an active lease');
      if (current.lease) {
        invariant(sameRequest(current.lease, { requestId, runnerRequestId, controlPlaneSha, sealKey }), 'RELEASE_WRITER_TAKEOVER_IDENTITY_MISMATCH',
          'Standby takeover must preserve the exact request, control plane and Seal Key', stateDetails(current));
      }
    }
    const generation = (current.leaseGeneration ?? 0) + 1;
    const issuedAt = now();
    const takeover = writerClass === 'standby';
    const lease = {
      schema: RELEASE_WRITER_LEASE_SCHEMA,
      project: key.project,
      physical_node: key.physical_node,
      release_target: key.release_target,
      writer_identity: writerIdentity,
      writer_class: writerClass,
      request_id: requestId,
      runner_request_id: runnerRequestId,
      control_plane_sha: controlPlaneSha,
      seal_key: sealKey,
      lease_generation: generation,
      issued_at: issuedAt.toISOString(),
      expires_at: new Date(issuedAt.getTime() + leaseSeconds * 1000).toISOString(),
      takeover_reason: takeover ? exactText(options.takeoverReason, 'RELEASE_WRITER_TAKEOVER_REASON_REQUIRED') : null,
      takeover_at: takeover ? issuedAt.toISOString() : null,
      original_writer: takeover ? current.lease?.writer_identity ?? 'primary-unavailable-before-lease' : null,
    };
    const path = `${paths.leases}${number(generation)}.json`;
    let publication;
    try {
      publication = await putJson(client, path, lease);
    } catch (error) {
      if (error?.code !== 'OSS_IMMUTABLE_OBJECT_CONFLICT') throw error;
      current = await read();
      if (current.leaseStatus === 'ACTIVE' && sameOwner(current.lease, { writerIdentity, writerClass, requestId, runnerRequestId, controlPlaneSha, sealKey })) {
        return outcome(current, { acquired: true, reused: true, actualSwitch: false });
      }
      throw conflict(current, writerIdentity, writerClass);
    }
    current = await read();
    return outcome(current, { acquired: publication.status === 'uploaded', reused: publication.status !== 'uploaded', actualSwitch: takeover });
  }

  async function renew(options) {
    assertWriterRole(options.actorRole);
    const current = await read();
    assertExactOwner(current, options);
    invariant(current.leaseStatus === 'ACTIVE', 'RELEASE_WRITER_RENEW_EXPIRED', 'Only an active Writer Lease can be renewed', stateDetails(current));
    const leaseSeconds = leaseDuration(options.leaseSeconds ?? 900);
    const generation = current.leaseGeneration;
    const renewals = await readNumbered(client, `${paths.renewals}${number(generation)}/`);
    const renewalGeneration = (renewals.at(-1)?.generation ?? 0) + 1;
    const renewedAt = now();
    const renewal = {
      schema: 'ai.delivery.release-writer-renewal.v1', generation: renewalGeneration,
      lease_generation: generation, writer_identity: current.activeWriter, request_id: current.currentRequestId,
      runner_request_id: current.runnerRequestId,
      control_plane_sha: current.controlPlaneSha, seal_key: current.sealKey,
      renewed_at: renewedAt.toISOString(), expires_at: new Date(renewedAt.getTime() + leaseSeconds * 1000).toISOString(),
    };
    const path = `${paths.renewals}${number(generation)}/${number(renewalGeneration)}.json`;
    try {
      const publication = await putJson(client, path, renewal);
      return outcome(await read(), { acquired: true, reused: publication.status !== 'uploaded', actualSwitch: false });
    } catch (error) {
      if (error?.code !== 'OSS_IMMUTABLE_OBJECT_CONFLICT') throw error;
      const canonical = await optionalJson(client, path);
      invariant(canonical && sameRenewal(canonical, renewal), 'RELEASE_WRITER_RENEW_CONFLICT', 'Writer Lease renewal conflicts with another writer', stateDetails(await read()));
      return outcome(await read(), { acquired: true, reused: true, actualSwitch: false });
    }
  }

  async function release(options) {
    assertWriterRole(options.actorRole);
    const current = await read();
    if (current.leaseStatus === 'RELEASED') {
      assertExactOwner(current, options);
      return outcome(current, { acquired: false, reused: true, actualSwitch: false });
    }
    assertExactOwner(current, options);
    const receipt = {
      schema: 'ai.delivery.release-writer-release.v1', lease_generation: current.leaseGeneration,
      writer_identity: current.activeWriter, writer_class: current.writerClass, request_id: current.currentRequestId,
      runner_request_id: current.runnerRequestId,
      control_plane_sha: current.controlPlaneSha, seal_key: current.sealKey, result: options.result ?? 'completed',
      released_at: now().toISOString(),
    };
    try {
      const publication = await putJson(client, `${paths.released}${number(current.leaseGeneration)}.json`, receipt);
      return outcome(await read(), { acquired: false, reused: publication.status !== 'uploaded', actualSwitch: false });
    } catch (error) {
      if (error?.code !== 'OSS_IMMUTABLE_OBJECT_CONFLICT') throw error;
      const released = await read();
      invariant(released.leaseStatus === 'RELEASED' && sameRequest(released.lease, options),
        'RELEASE_WRITER_RELEASE_CONFLICT', 'Writer Lease release conflicts with another result', stateDetails(released));
      return outcome(released, { acquired: false, reused: true, actualSwitch: false });
    }
  }

  async function run(options, operation) {
    const acquired = await acquire(options);
    if (acquired.completed === true) {
      return { value: { repeatedDeployment: true, actualSwitch: false, reusedWriterResult: true }, writer: acquired };
    }
    const leaseSeconds = leaseDuration(options.leaseSeconds ?? 900);
    let renewal = Promise.resolve();
    let renewalError = null;
    const timer = scheduleInterval(() => {
      renewal = renewal.then(async () => {
        if (!renewalError) await renew(options);
      }).catch((error) => { renewalError = error; });
      return renewal;
    }, Math.max(10, Math.floor(leaseSeconds / 3)) * 1000);
    timer?.unref?.();
    try {
      const value = await operation(acquired);
      cancelInterval(timer);
      await renewal;
      if (renewalError) throw renewalError;
      const closed = await release({ ...options, result: value?.repeatedDeployment === true ? 'idempotent' : 'completed' });
      return { value, writer: { ...closed, actualSwitch: acquired.actualSwitch, reused: acquired.reused } };
    } catch (error) {
      cancelInterval(timer);
      await renewal;
      await release({ ...options, result: error?.code?.includes('ROLLED_BACK') ? 'rolled-back' : 'failed' }).catch(() => {});
      throw error;
    } finally {
      cancelInterval(timer);
    }
  }

  return Object.freeze({ key, paths, read, acquire, renew, release, run });
}

export function writerLeasePaths(identity) {
  const key = normalizeIdentity(identity);
  const root = `${key.project}/release-writers/v1/${key.physical_node}/${key.release_target}/`;
  return Object.freeze({ root, leases: `${root}leases/`, renewals: `${root}renewals/`, released: `${root}released/` });
}

export function selectReleaseWriterClass({ primaryAvailable, standbyAvailable, leaseStatus, activeWriterClass = null }) {
  if (leaseStatus === 'ACTIVE') {
    const activeAvailable = activeWriterClass === 'primary' ? primaryAvailable : activeWriterClass === 'standby' ? standbyAvailable : false;
    return Object.freeze({ writerClass: activeAvailable ? activeWriterClass : null, action: activeAvailable ? 'continue' : 'wait',
      message: activeAvailable && activeWriterClass === 'primary' ? '主Release执行中' : activeAvailable ? 'Standby已安全接管' : '等待主Release租约' });
  }
  if (primaryAvailable === true) return Object.freeze({ writerClass: 'primary', action: 'acquire', message: '主Release执行中' });
  if (standbyAvailable === true) return Object.freeze({ writerClass: 'standby', action: 'takeover', message: 'Standby已安全接管' });
  invariant(false, 'RELEASE_WRITERS_UNAVAILABLE', 'Neither Primary nor Standby Release writer is available', {
    stage: 'release-writer-selection', retryable: true, nextSafeAction: 'restore-one-release-runner-without-starting-a-second-writer',
  });
}

function normalizeIdentity(identity) {
  return Object.freeze({
    project: exactName(identity.project, 'RELEASE_WRITER_PROJECT_INVALID'),
    physical_node: exactName(identity.physicalNode ?? identity.physical_node, 'RELEASE_WRITER_NODE_INVALID'),
    release_target: exactName(identity.releaseTarget ?? identity.release_target, 'RELEASE_WRITER_TARGET_INVALID'),
  });
}

function outcome(current, extra) {
  return Object.freeze({ schema: 'ai.delivery.release-writer-result.v1', activeWriter: current.activeWriter,
    writerClass: current.writerClass, leaseGeneration: current.leaseGeneration, leaseIssuedAt: current.leaseIssuedAt,
    leaseExpiresAt: current.leaseExpiresAt, leaseStatus: current.leaseStatus, takeoverReason: current.takeoverReason,
    takeoverAt: current.takeoverAt, originalWriter: current.originalWriter, currentRequestId: current.currentRequestId,
    runnerRequestId: current.runnerRequestId, sealKey: current.sealKey, controlPlaneSha: current.controlPlaneSha, ...extra });
}

function state(leaseStatus, updatedAt, details) {
  return Object.freeze({ schema: RELEASE_WRITER_STATE_SCHEMA, leaseStatus, updatedAt, ...details });
}

function assertExactOwner(current, options) {
  invariant(current.lease, 'RELEASE_WRITER_LEASE_MISSING', 'Release Writer Lease does not exist');
  invariant(sameOwner(current.lease, {
    writerIdentity: options.writerIdentity, writerClass: options.writerClass, requestId: options.requestId,
    runnerRequestId: options.runnerRequestId, controlPlaneSha: options.controlPlaneSha, sealKey: options.sealKey,
  }), 'RELEASE_WRITER_NOT_OWNER', 'Only the exact current writer may renew or release the lease', stateDetails(current));
}

function sameOwner(lease, expected) {
  return lease?.writer_identity === expected.writerIdentity && lease?.writer_class === expected.writerClass
    && lease?.request_id === expected.requestId && lease?.runner_request_id === expected.runnerRequestId
    && lease?.control_plane_sha === expected.controlPlaneSha && lease?.seal_key === expected.sealKey;
}

function sameRequest(lease, expected) {
  return lease?.request_id === expected.requestId && lease?.runner_request_id === expected.runnerRequestId
    && lease?.control_plane_sha === expected.controlPlaneSha && lease?.seal_key === expected.sealKey;
}

function sameRenewal(left, right) {
  return ['lease_generation', 'writer_identity', 'request_id', 'runner_request_id', 'control_plane_sha', 'seal_key'].every((key) => left[key] === right[key]);
}

function conflict(current, writerIdentity, writerClass) {
  return new DeliveryError('RELEASE_WRITER_LEASE_CONFLICT', 'A different Release writer owns the active lease', conflictDetails(current, writerIdentity, writerClass));
}

function conflictDetails(current, writerIdentity, writerClass) {
  return { ...stateDetails(current), requestedWriter: writerIdentity, requestedWriterClass: writerClass,
    stage: 'release-writer-acquire', retryable: false, nextSafeAction: 'wait-for-current-writer-lease-without-retrying-the-write' };
}

function stateDetails(current) {
  return { activeWriter: current.activeWriter, writerClass: current.writerClass, leaseGeneration: current.leaseGeneration,
    leaseStatus: current.leaseStatus, leaseExpiresAt: current.leaseExpiresAt, currentRequestId: current.currentRequestId,
    runnerRequestId: current.runnerRequestId };
}

async function readNumbered(client, prefix) {
  const objects = (await client.listPrefix(prefix)).filter((path) => /\/\d{6}\.json$/.test(path)).sort();
  const values = [];
  for (const object of objects) values.push(JSON.parse((await client.getObject(object)).toString('utf8')));
  return values.sort((left, right) => (left.lease_generation ?? left.generation) - (right.lease_generation ?? right.generation));
}

async function optionalJson(client, path) {
  try { return JSON.parse((await client.getObject(path)).toString('utf8')); }
  catch (error) { if (['OSS_OBJECT_NOT_FOUND', 'OSS_ARTIFACT_NOT_FOUND'].includes(error?.code)) return null; throw error; }
}

async function putJson(client, path, value) {
  return client.putImmutable(path, Buffer.from(prettyStableJson(value)), 'application/json');
}

function number(value) { return String(value).padStart(6, '0'); }
function exactName(value, code) { invariant(NAME.test(String(value ?? '')), code, 'Expected a stable identifier'); return value; }
function exactText(value, code) { invariant(typeof value === 'string' && value.trim() !== '', code, 'Expected non-empty text'); return value.trim(); }
function exactSha(value, code) { invariant(SHA.test(String(value ?? '')), code, 'Expected one full lowercase Git SHA'); return value; }
function exactDigest(value, code) { invariant(DIGEST.test(String(value ?? '')), code, 'Expected one SHA-256 digest'); return value; }
function exactRequestId(value, code = 'RELEASE_WRITER_REQUEST_ID_INVALID') { invariant(/^[a-f0-9]{64}$/.test(String(value ?? '')), code, 'Expected one stable 64-character request ID'); return value; }
function writerClassValue(value) { invariant(['primary', 'standby'].includes(value), 'RELEASE_WRITER_CLASS_INVALID', 'Release writer class must be primary or standby'); return value; }
function leaseDuration(value) { const seconds = Number(value); invariant(Number.isSafeInteger(seconds) && seconds >= 30 && seconds <= 900, 'RELEASE_WRITER_LEASE_DURATION_INVALID', 'Release Writer Lease must be 30-900 seconds'); return seconds; }
function assertWriterRole(role) { invariant(role === 'release', 'RELEASE_WRITER_ROLE_FORBIDDEN', 'Only the Release role may acquire a Writer Lease'); }
function assertClient(client) { invariant(client && ['listPrefix', 'getObject', 'putImmutable'].every((name) => typeof client[name] === 'function'), 'RELEASE_WRITER_STORE_INVALID', 'Release Writer Lease requires the existing immutable OSS store'); }
