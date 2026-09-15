import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { DeliveryError } from '../src/errors.mjs';
import { executeWithCredentialRefresh, evaluateReleaseBundle, reconcileDeliveryState, RECONCILE_ACTIONS, RECONCILE_STATES } from '../src/delivery-reconcile.mjs';
import { createSealKey, FINAL_SEAL_SCHEMA } from '../src/seal-lifecycle.mjs';
import { digest } from '../src/stable.mjs';

const identity = { sourceSha: 'a'.repeat(40), controlPlaneSha: 'b'.repeat(40), target: 'console', physicalNode: 'node-a',
  artifactDigest: `sha256:${'c'.repeat(64)}`, requestId: 'request-1', attemptId: 'attempt-1', requestOwner: 'owner-a', expectedRole: 'releaser' };
const resources = { uploaded: 'fixture/console/uploaded.json', validated: 'fixture/console/candidate-validation.json', final: 'fixture/console/final-seal.json' };
const key = createSealKey({ sourceSha: identity.sourceSha, controlPlaneSha: identity.controlPlaneSha, releaseTarget: identity.target,
  physicalNode: identity.physicalNode, artifactDigest: identity.artifactDigest });
const uploaded = { schema: 'ai.delivery.uploaded.v1', seal_key: key.seal_key, artifact: { digest: identity.artifactDigest, object: 'artifact.tgz' },
  provenance: { digest: `sha256:${'d'.repeat(64)}`, object: 'provenance.json' }, updated_at: '2026-01-01T00:00:00Z' };
const validated = { schema: 'ai.delivery.candidate-validation.v1', seal_key: key.seal_key, artifact: uploaded.artifact,
  provenance: uploaded.provenance, updated_at: '2026-01-01T00:01:00Z' };
const finalUnsigned = { schema: FINAL_SEAL_SCHEMA, seal_key_schema: 'ai.delivery.seal-key.v1', seal_key: key.seal_key, key,
  artifact: uploaded.artifact, provenance: uploaded.provenance,
  candidate_validation: { object: resources.validated, digest: digest(validated) }, updated_at: '2026-01-01T00:02:00Z' };
const final = { ...finalUnsigned, seal_digest: digest(finalUnsigned) };

test('state and action vocabularies include every required terminal and recovery class', () => {
  for (const state of ['ABSENT', 'BUILDING', 'UPLOADED', 'VALIDATED', 'SEALING', 'SEALED', 'FAILED_RETRYABLE', 'FAILED_BLOCKED', 'AMBIGUOUS_WRITE', 'OWNER_CONFLICT']) assert.ok(RECONCILE_STATES.includes(state));
  for (const action of ['NOOP_ALREADY_SEALED', 'RESUME_UPLOAD', 'RESUME_VALIDATION', 'RESUME_FINAL_SEAL_WRITE', 'REFRESH_CREDENTIAL_AND_RETRY', 'STOP_SECURITY_MISMATCH', 'STOP_PERMISSION_DENIED', 'STOP_OWNER_CONFLICT']) assert.ok(RECONCILE_ACTIONS.includes(action));
});

test('exact matching final Seal returns no-op success and never writes', async () => {
  const fixture = evidence({ uploaded, validated, final });
  const result = await reconcileDeliveryState(input(), { client: fixture.client, now: fixedNow });
  assert.equal(result.state, 'SEALED'); assert.equal(result.action, 'NOOP_ALREADY_SEALED'); assert.equal(fixture.writes, 0); assert.equal(fixture.lists, 0);
});

test('uploaded and validated with missing final resumes only final Seal write', async () => {
  const fixture = evidence({ uploaded, validated });
  const result = await reconcileDeliveryState(input(), { client: fixture.client, now: fixedNow });
  assert.equal(result.state, 'FAILED_RETRYABLE'); assert.equal(result.action, 'RESUME_FINAL_SEAL_WRITE');
  assert.equal(result.resumeFrom, 'FINAL_SEAL_WRITE'); assert.deepEqual(result.completedEvidence, [resources.uploaded, resources.validated]);
});

test('ambiguous Seal write that actually succeeded resolves to sealed without rewrite', async () => {
  const fixture = evidence({ uploaded, validated, final });
  const result = await reconcileDeliveryState(input({ failure: { kind: 'ambiguous-write' } }), { client: fixture.client, now: fixedNow });
  assert.equal(result.action, 'NOOP_ALREADY_SEALED'); assert.equal(fixture.writes, 0);
});

test('ambiguous Seal write that is absent retries only within its exact budget', async () => {
  const fixture = evidence({ uploaded, validated });
  const result = await reconcileDeliveryState(input({ failure: { kind: 'ambiguous-write' }, retryPolicy: { count: 1, budget: 2 } }), { client: fixture.client, now: fixedNow });
  assert.equal(result.state, 'AMBIGUOUS_WRITE'); assert.equal(result.retryable, true); assert.equal(result.exactResource, resources.final);
});

test('ambiguous Seal write stops when its retry budget is exhausted', async () => {
  const result = await reconcileDeliveryState(input({ failure: { kind: 'ambiguous-write' }, retryPolicy: { count: 2, budget: 2 } }),
    { client: evidence({ uploaded, validated }).client, now: fixedNow });
  assert.equal(result.state, 'FAILED_BLOCKED'); assert.equal(result.action, 'STOP_RETRY_BUDGET_EXHAUSTED');
});

test('STS expiry refreshes once with bounded exponential backoff and audit', async () => {
  let operations = 0; let refreshes = 0; const delays = [];
  const result = await executeWithCredentialRefresh(async ({ credential }) => {
    operations += 1; if (operations === 1) throw new DeliveryError('STS_CREDENTIAL_EXPIRED', 'expired'); return credential;
  }, { credential: 'expired', budget: 2, exactResource: resources.final, random: () => 0, sleep: async (ms) => delays.push(ms),
    refresh: async () => { refreshes += 1; return 'fresh'; } });
  assert.equal(result.value, 'fresh'); assert.equal(refreshes, 1); assert.deepEqual(delays, [250]); assert.equal(result.audit.length, 1);
});

test('403 permission denial is blocked, explainable and resumable only after repair', async () => {
  const fixture = evidence({ uploaded, validated });
  const result = await reconcileDeliveryState(input({ failure: { kind: 'permission-denied', identity: 'sensitive-principal', roleKind: 'releaser',
    ossAction: 'oss:PutObject', exactResource: resources.final } }), { client: fixture.client, now: fixedNow });
  assert.equal(result.state, 'FAILED_BLOCKED'); assert.equal(result.action, 'STOP_PERMISSION_DENIED'); assert.equal(result.retryable, false);
  assert.equal(result.resumeAllowed, true); assert.equal(result.denial.ossAction, 'oss:PutObject'); assert.doesNotMatch(JSON.stringify(result), /sensitive-principal/);
});

test('exact Get ImplicitDeny becomes a blocked decision and resumes after permission repair', async () => {
  let repaired = false;
  const fixture = evidence({ uploaded, validated });
  const client = { ...fixture.client, async getObject(path, missingCode) {
    if (!repaired && path === resources.final) throw new DeliveryError('OSS_GET_FAILED', 'ImplicitDeny', { status: 403, detail: 'ImplicitDeny' });
    return fixture.client.getObject(path, missingCode);
  } };
  const blocked = await reconcileDeliveryState(input({ credentialSummary: { provider: 'github-oidc', subject: 'repo:sensitive' } }), { client, now: fixedNow });
  assert.equal(blocked.failureClass, 'OSS_IMPLICIT_DENY'); assert.equal(blocked.action, 'STOP_PERMISSION_DENIED'); assert.equal(blocked.retryable, false);
  repaired = true;
  const resumed = await reconcileDeliveryState(input(), { client, now: fixedNow });
  assert.equal(resumed.action, 'RESUME_FINAL_SEAL_WRITE'); assert.equal(resumed.resumeFrom, 'FINAL_SEAL_WRITE');
});

for (const [field, changed] of [
  ['sourceSha', 'e'.repeat(40)], ['controlPlaneSha', 'e'.repeat(40)], ['target', 'web-api'], ['physicalNode', 'node-b'],
  ['artifactDigest', `sha256:${'e'.repeat(64)}`],
]) test(`${field} mismatch is a non-resumable security stop`, async () => {
  const mismatchedKey = createSealKey({ sourceSha: field === 'sourceSha' ? changed : identity.sourceSha,
    controlPlaneSha: field === 'controlPlaneSha' ? changed : identity.controlPlaneSha,
    releaseTarget: field === 'target' ? changed : identity.target, physicalNode: field === 'physicalNode' ? changed : identity.physicalNode,
    artifactDigest: field === 'artifactDigest' ? changed : identity.artifactDigest });
  const fixture = evidence({ uploaded: { ...uploaded, seal_key: mismatchedKey.seal_key,
    artifact: { ...uploaded.artifact, digest: mismatchedKey.artifact_digest } } });
  const result = await reconcileDeliveryState(input(), { client: fixture.client, now: fixedNow });
  assert.equal(result.action, 'STOP_SECURITY_MISMATCH'); assert.equal(result.resumeAllowed, false);
});

test('validated receipt without uploaded evidence cannot forge a checkpoint', async () => {
  const result = await reconcileDeliveryState(input(), { client: evidence({ validated }).client, now: fixedNow });
  assert.equal(result.state, 'FAILED_BLOCKED'); assert.equal(result.action, 'STOP_SECURITY_MISMATCH');
});

test('provenance mismatch is a non-resumable security stop', async () => {
  const changed = { ...validated, provenance: { ...validated.provenance, digest: `sha256:${'e'.repeat(64)}` } };
  const result = await reconcileDeliveryState(input(), { client: evidence({ uploaded, validated: changed }).client, now: fixedNow });
  assert.equal(result.state, 'FAILED_BLOCKED'); assert.equal(result.action, 'STOP_SECURITY_MISMATCH');
});

test('two live owners preserve the unique writer lease', async () => {
  const result = await reconcileDeliveryState(input({ control: { owner: 'owner-b', checkpoint: 'BUILDING',
    lease: { expiresAt: '2026-01-01T01:00:00Z', exactResource: 'fixture/control/lease.json' } } }), { client: evidence({}).client, now: fixedNow });
  assert.equal(result.state, 'OWNER_CONFLICT'); assert.equal(result.action, 'STOP_OWNER_CONFLICT');
});

test('repeated reconcile is idempotent and performs only exact reads', async () => {
  const fixture = evidence({ uploaded, validated, final });
  const first = await reconcileDeliveryState(input(), { client: fixture.client, now: fixedNow });
  const second = await reconcileDeliveryState(input(), { client: fixture.client, now: fixedNow });
  assert.deepEqual(first, second); assert.equal(fixture.reads, 6); assert.equal(fixture.writes, 0); assert.equal(fixture.lists, 0);
});

test('console failure does not prevent web-api from independently reaching sealed', async () => {
  const consoleState = await reconcileDeliveryState(input({ failure: { kind: 'permission-denied', exactResource: resources.final } }),
    { client: evidence({ uploaded, validated }).client, now: fixedNow });
  const webIdentity = { ...identity, target: 'web-api', artifactDigest: `sha256:${'f'.repeat(64)}` };
  const web = receipts(webIdentity);
  const webState = await reconcileDeliveryState(input({ ...webIdentity, resources: web.resources }), { client: evidence(web).client, now: fixedNow });
  assert.equal(consoleState.state, 'FAILED_BLOCKED'); assert.equal(webState.state, 'SEALED');
});

test('bundle gate denies one missing Seal and allows only all exact Seals', () => {
  const required = [component('console', identity), component('web-api', { ...identity, target: 'web-api', artifactDigest: `sha256:${'f'.repeat(64)}` })];
  const consoleState = state('console', identity, 'SEALED');
  const missing = evaluateReleaseBundle({ sourceSha: identity.sourceSha, controlPlaneSha: identity.controlPlaneSha, requiredComponents: required, componentStates: [consoleState] });
  assert.equal(missing.allowDeploy, false); assert.equal(missing.action, 'DENY_DEPLOY_INCOMPLETE_BUNDLE');
  const complete = evaluateReleaseBundle({ sourceSha: identity.sourceSha, controlPlaneSha: identity.controlPlaneSha, requiredComponents: required,
    componentStates: [consoleState, state('web-api', { ...identity, target: 'web-api', artifactDigest: `sha256:${'f'.repeat(64)}` }, 'SEALED')] });
  assert.equal(complete.allowDeploy, true); assert.equal(complete.action, 'ALLOW_CONTRACT_DEPLOY');
});

test('all reconcile fields are present and secret values are redacted', async () => {
  const secret = 'fixture-secret-token';
  const result = await reconcileDeliveryState(input({ secretValues: [secret], control: { owner: secret } }), { client: evidence({}).client, now: fixedNow });
  for (const name of ['sourceSha', 'controlPlaneSha', 'target', 'physicalNode', 'artifactDigest', 'requestId', 'attemptId', 'owner', 'lease',
    'completedEvidence', 'failureClass', 'retryable', 'resumeAllowed', 'resumeFrom', 'nextSafeAction', 'exactResource', 'retryCount', 'retryBudget', 'timestamp']) assert.ok(name in result, name);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
});

test('machine contract keeps bounded List where CAS is not proven', async () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
  const contract = JSON.parse(await readFile(join(root, '04_tools/release-engine/policies/resumable-state-machine.json'), 'utf8'));
  assert.equal(contract.authority.workflowOutputIsAuthority, false);
  assert.equal(contract.casReplacementStatus, 'NOT_PROVEN_KEEP_BOUNDED_LIST');
  assert.ok(contract.listStillRequiredFor.includes('writer-lease-renewal-generation'));
});

function input(overrides = {}) { return { ...identity, resources, retryPolicy: { count: 0, budget: 3 }, ...overrides }; }
function fixedNow() { return new Date('2026-01-01T00:30:00Z'); }
function evidence(values) {
  let reads = 0; let writes = 0; let lists = 0;
  const paths = values.resources ?? resources;
  const map = new Map([[paths.uploaded, values.uploaded], [paths.validated, values.validated], [paths.final, values.final]].filter(([, value]) => value));
  return { get reads() { return reads; }, get writes() { return writes; }, get lists() { return lists; }, client: {
    async getObject(path, missingCode) { reads += 1; if (!map.has(path)) throw new DeliveryError(missingCode, 'missing'); return Buffer.from(JSON.stringify(map.get(path))); },
    async putImmutable() { writes += 1; }, async listPrefix() { lists += 1; return []; },
  } };
}
function receipts(nextIdentity) {
  const nextKey = createSealKey({ sourceSha: nextIdentity.sourceSha, controlPlaneSha: nextIdentity.controlPlaneSha, releaseTarget: nextIdentity.target,
    physicalNode: nextIdentity.physicalNode, artifactDigest: nextIdentity.artifactDigest });
  const nextResources = { uploaded: `fixture/${nextIdentity.target}/uploaded.json`, validated: `fixture/${nextIdentity.target}/candidate-validation.json`, final: `fixture/${nextIdentity.target}/final-seal.json` };
  const nextUploaded = { ...uploaded, seal_key: nextKey.seal_key, artifact: { ...uploaded.artifact, digest: nextIdentity.artifactDigest } };
  const nextValidated = { ...validated, seal_key: nextKey.seal_key, artifact: nextUploaded.artifact };
  const unsigned = { ...finalUnsigned, seal_key: nextKey.seal_key, key: nextKey, artifact: nextUploaded.artifact, provenance: nextUploaded.provenance,
    candidate_validation: { object: nextResources.validated, digest: digest(nextValidated) } };
  return { resources: nextResources, uploaded: nextUploaded, validated: nextValidated, final: { ...unsigned, seal_digest: digest(unsigned) } };
}
function component(componentId, value) { return { componentId, target: value.target, physicalNode: value.physicalNode, artifactDigest: value.artifactDigest, exactResource: `fixture/${componentId}/final-seal.json` }; }
function state(componentId, value, stateValue) { return { componentId, sourceSha: value.sourceSha, controlPlaneSha: value.controlPlaneSha, target: value.target,
  physicalNode: value.physicalNode, artifactDigest: value.artifactDigest, state: stateValue, exactResource: `fixture/${componentId}/final-seal.json` }; }
