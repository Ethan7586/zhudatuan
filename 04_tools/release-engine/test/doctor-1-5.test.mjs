import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { doctorCommand, DOCTOR_SCHEMA } from '../src/doctor.mjs';
import { DeliveryError, deliveryErrorContract, redactDeliveryDetails } from '../src/errors.mjs';
import { auditWorkflowSecretContracts, loadWorkflowDocuments } from '../src/secret-contract.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceSha = 'a'.repeat(40);
const controlSha = 'b'.repeat(40);
const adapter = { project: 'fixture', projectRoot: root, targets: { app: {} }, nodes: { 'node-a': { deployments: { app: { pointerRoot: '/opt/app', service: 'app.service' } } } } };
const options = { sourceSha, controlSha, target: 'app', node: 'node-a', repository: 'owner/repository' };
const runners = ['aliyun-staging-zdt-build', 'aliyun-staging-zdt-build-2', 'aliyun-staging-zdt-release', 'aliyun-staging-zdt-release-standby']
  .map((name, index) => ({ name, status: index === 3 ? 'offline' : 'online', busy: false }));

test('missing Runner observer token is a pre-Prepare configuration failure', async () => {
  const result = await doctorCommand(adapter, options, deps({ environment: environment({ ZDT_RUNNER_READ_TOKEN: '' }) }));
  assert.equal(result.readiness, 'BLOCKED');
  assert.equal(error(result, 'GITHUB_RUNNER_READ_TOKEN_REQUIRED').category, 'CONFIGURATION');
});

test('present Runner token with a minimum read 403 is a security denial', async () => {
  const denied = new DeliveryError('GITHUB_RUNNER_READ_FAILED', 'HTTP 403', { status: 403 });
  const result = await doctorCommand(adapter, options, deps({ githubProbe: async () => { throw denied; } }));
  assert.equal(error(result, 'GITHUB_RUNNER_READ_FAILED').category, 'SECURITY_DENIAL');
});

test('callee use without workflow_call declaration is rejected', () => {
  const workflows = {
    'leaf.yml': { on: { workflow_call: { secrets: {} } }, jobs: { use: { 'runs-on': 'ubuntu', env: { TOKEN: '${{ secrets.READ_TOKEN }}' } } } },
  };
  assert.ok(auditWorkflowSecretContracts(workflows).issues.some(({ code }) => code === 'SECRET_USED_BUT_NOT_DECLARED'));
});

test('required secret omitted by an intermediate reusable workflow is rejected', () => {
  const workflows = chainWorkflows();
  delete workflows['middle.yml'].jobs.call.secrets.READ_TOKEN;
  assert.ok(auditWorkflowSecretContracts(workflows).issues.some(({ code }) => code === 'SECRET_EXPLICIT_PASS_MISSING'));
});

test('wrong OSS Bucket configuration fails before any OSS call', async () => {
  let calls = 0;
  const result = await doctorCommand(adapter, options, deps({ environment: environment({ ALIYUN_OSS_BUCKET: '!' }), ossClient: { async listPrefix() { calls += 1; } } }));
  assert.equal(error(result, 'OSS_CONFIGURATION_INVALID').category, 'CONFIGURATION');
  assert.equal(calls, 0);
});

test('OSS response separates a wrong Bucket name from RAM account ownership', () => {
  assert.deepEqual(contractFor('NoSuchBucket: specified bucket does not exist').redactedDetails.diagnosis.candidateCauses, ['BUCKET_NAME_MISMATCH']);
  assert.deepEqual(contractFor('The bucket you access does not belong to you').redactedDetails.diagnosis.candidateCauses,
    ['BUCKET_NAME_MISMATCH', 'RAM_PRINCIPAL_ACCOUNT_OWNERSHIP_MISMATCH']);
});

test('OSS endpoint or region mismatch remains distinguishable', () => {
  const value = contractFor('The endpoint is not in the bucket region');
  assert.ok(value.redactedDetails.diagnosis.candidateCauses.includes('ENDPOINT_REGION_MISMATCH'));
});

test('Resource Group SubUser implicit denial maps to the current stable contract', () => {
  const value = contractFor('<PolicyType>ResourceGroupLevelIdentityBasedPolicy</PolicyType><AuthPrincipalType>SubUser</AuthPrincipalType><NoPermissionType>ImplicitDeny</NoPermissionType>');
  assert.equal(value.code, 'OSS_LIST_FAILED');
  assert.equal(value.category, 'SECURITY_DENIAL');
  assert.equal(value.retryable, false);
  assert.equal(value.nextSafeAction, 'repair-minimal-ram-policy-and-rerun-doctor');
  assert.deepEqual(value.redactedDetails.diagnosis.candidateCauses, ['RESOURCE_GROUP_NOT_AUTHORIZED', 'RAM_SUBUSER_IDENTITY', 'IDENTITY_POLICY_IMPLICIT_DENY']);
});

test('explicit Deny is not confused with an implicit denial', () => {
  assert.deepEqual(contractFor('AccessDenied ExplicitDeny').redactedDetails.diagnosis.candidateCauses, ['EXPLICIT_DENY']);
});

test('Prefix authorization failure is classified independently', () => {
  assert.deepEqual(contractFor('prefix fixture/app is not authorized: forbidden').redactedDetails.diagnosis.candidateCauses, ['PREFIX_NOT_AUTHORIZED']);
});

test('exact read failure reports the release index and preserves bounded generation List needs', async () => {
  const result = await doctorCommand(adapter, options, deps({ ossClient: failingOss('AccessDenied ExplicitDeny') }));
  const check = result.checks.find(({ id }) => id === 'oss-read');
  assert.match(check.evidence.object, /release-index-r4-seal-lifecycle\.json$/);
  assert.equal(check.evidence.listUsed, false);
  assert.ok(check.evidence.listStillRequiredFor.includes('runner-lease-generation-discovery'));
});

test('allowed exact reads never upgrade unknown write authority to PASS', async () => {
  let gets = 0;
  const object = `fixture/app/${sourceSha}/seals/v1/node-a/digest/${controlSha}/final-seal.json`;
  const result = await doctorCommand(adapter, options, deps({ ossClient: {
    async headObject() { gets += 1; return { exists: true }; }, async getObject() { return Buffer.from('{}'); },
    async putImmutable() { throw new Error('Doctor must never write'); },
  }, exactSealProbe: async () => ({ object }) }));
  assert.equal(gets, 1);
  assert.equal(result.checks.find(({ id }) => id === 'oss-write-capability').status, 'UNVERIFIED');
});

test('secrets are absent from structured errors, logs and snapshots', () => {
  const secret = 'obviously-fake-secret-value';
  const redacted = redactDeliveryDetails({ token: secret, nested: { message: `url?Signature=${secret}`, accessKeyId: secret } }, [secret]);
  const serialized = JSON.stringify(redacted);
  assert.doesNotMatch(serialized, new RegExp(secret));
  assert.match(serialized, /REDACTED/);
});

test('structured command failures retain redacted actionable evidence', () => {
  const secret = 'obviously-fake-secret-value';
  const failure = new DeliveryError('COMMAND_FAILED', 'deploy failed', {
    exitCode: 1,
    outputTail: `remote health failed url?Signature=${secret}`,
  });
  const contract = deliveryErrorContract(failure, { stage: 'deploy', secretValues: [secret] });
  assert.equal(contract.redactedDetails.exitCode, 1);
  assert.match(contract.redactedDetails.outputTail, /remote health failed/);
  assert.doesNotMatch(contract.redactedDetails.outputTail, new RegExp(secret));
});

test('Doctor failure cannot trigger Prepare, Seal, Deploy or a write lease', async () => {
  let reads = 0;
  const result = await doctorCommand(adapter, options, deps({ ossClient: { async headObject() { reads += 1; throw ossDenied('ExplicitDeny'); } } }));
  assert.equal(reads, 1);
  assert.deepEqual(result.boundaries, { readOnly: true, prepareTriggered: false, sealCreated: false, deployTriggered: false,
    runnerSwitched: false, writerLeaseAcquired: false, productionPointerMoved: false });
});

test('current repository reusable workflows pass the explicit Secret gate', async () => {
  const audit = auditWorkflowSecretContracts(await loadWorkflowDocuments(root));
  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
  assert.ok(audit.graph.length >= 9);
});

test('Doctor emits one stable machine schema and preserves the production score boundary', async () => {
  const result = await doctorCommand(adapter, options, deps());
  assert.equal(result.schema, DOCTOR_SCHEMA);
  assert.equal(result.version, '1.5.0');
  assert.equal(result.boundaries.readOnly, true);
  assert.equal(result.checks.find(({ id }) => id === 'oss-write-capability').evidence.code, 'UNVERIFIED_WRITE_CAPABILITY');
});

test('every readiness error uses the complete stable error contract', async () => {
  const result = await doctorCommand(adapter, options, deps({ environment: environment({ ZDT_RUNNER_READ_TOKEN: '' }) }));
  const required = ['code', 'category', 'stage', 'retryable', 'attempts', 'requestId', 'affectedCapability', 'evidence',
    'nextSafeAction', 'resumeAllowed', 'redactedDetails'];
  for (const item of result.errors) assert.deepEqual(Object.keys(item), required);
});

test('closure Resume requires both failed-run evidence and base-to-source ancestry', async () => {
  const result = await doctorCommand(adapter, { ...options, baseSha: 'c'.repeat(40) }, deps({
    githubProbe: async () => ({ latestControlSha: controlSha, runners, closureRuns: [{ head_sha: sourceSha, status: 'completed', conclusion: 'failure' }] }),
    ancestorProbe: async () => true,
  }));
  assert.equal(result.checks.find(({ id }) => id === 'failed-closure-evidence').status, 'PASS');
  assert.equal(result.checks.find(({ id }) => id === 'closure-ancestry').status, 'PASS');
});

test('closure Resume fails closed when history or ancestry is not exact', async () => {
  const ancestryError = new DeliveryError('GIT_ANCESTOR_REQUIRED', 'not ancestor');
  const result = await doctorCommand(adapter, { ...options, baseSha: 'c'.repeat(40) }, deps({
    githubProbe: async () => ({ latestControlSha: controlSha, runners, closureRuns: [] }),
    ancestorProbe: async () => { throw ancestryError; },
  }));
  assert.ok(result.errors.some(({ code }) => code === 'FAILED_CLOSURE_EVIDENCE_MISSING'));
  assert.ok(result.errors.some(({ code }) => code === 'GIT_ANCESTOR_REQUIRED'));
  assert.equal(result.readyForPrepare, false);
});

function deps(overrides = {}) {
  return {
    environment: environment(), workflows: {},
    githubProbe: async () => ({ latestControlSha: controlSha, runners }),
    ossClient: { async headObject() { return { exists: false }; }, async getObject() { return Buffer.from('{}'); } },
    remoteProbe: async () => ({ current: '/opt/app/current', previous: '/opt/app/previous', rollbackVisible: true }),
    ...overrides,
  };
}

function environment(overrides = {}) {
  return {
    ZDT_RUNNER_READ_TOKEN: 'fake-runner-token', ALIYUN_OSS_ACCESS_KEY_ID: 'fake-id', ALIYUN_OSS_ACCESS_KEY_SECRET: 'fake-key',
    ALIYUN_OSS_BUCKET: 'fixture-bucket', ALIYUN_OSS_ENDPOINT: 'https://oss-cn-test.aliyuncs.com',
    AI_DELIVERY_AUTH_MODE: 'static-access-key', AI_DELIVERY_ROLE_KIND: 'observer', AI_DELIVERY_ALLOW_STATIC_ACCESS_KEY: 'true', ...overrides,
  };
}

function failingOss(detail) { return { async headObject() { throw ossDenied(detail); } }; }
function ossDenied(detail) { return new DeliveryError('OSS_LIST_FAILED', 'OSS_LIST_FAILED: HTTP 403', { status: 403, detail }); }
function contractFor(detail) { return deliveryErrorContract(ossDenied(detail), { stage: 'runner-selection', affectedCapability: 'oss-read' }); }
function error(result, code) { const found = result.errors.find((item) => item.code === code); assert.ok(found, code); return found; }

function chainWorkflows() {
  return {
    'root.yml': { jobs: { call: { uses: './.github/workflows/middle.yml', secrets: { READ_TOKEN: '${{ secrets.READ_TOKEN }}' } } } },
    'middle.yml': { on: { workflow_call: { secrets: { READ_TOKEN: { required: true } } } }, jobs: {
      call: { uses: './.github/workflows/leaf.yml', secrets: { READ_TOKEN: '${{ secrets.READ_TOKEN }}' } },
    } },
    'leaf.yml': { on: { workflow_call: { secrets: { READ_TOKEN: { required: true } } } }, jobs: {
      use: { 'runs-on': 'ubuntu', env: { TOKEN: '${{ secrets.READ_TOKEN }}' } },
    } },
  };
}
