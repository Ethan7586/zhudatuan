import { deliveryErrorContract, invariant } from './errors.mjs';
import { createOssClient } from './oss.mjs';
import { createRunnerRequest } from './runner-routing.mjs';
import { auditWorkflowSecretContracts, loadWorkflowDocuments } from './secret-contract.mjs';
import { assertGitAncestor } from './git.mjs';

const SHA = /^[a-f0-9]{40}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const REQUIRED_OSS = ['ALIYUN_OSS_ACCESS_KEY_ID', 'ALIYUN_OSS_ACCESS_KEY_SECRET', 'ALIYUN_OSS_BUCKET', 'ALIYUN_OSS_ENDPOINT'];
const RUNNERS = Object.freeze(['aliyun-staging-zdt-build', 'aliyun-staging-zdt-build-2', 'aliyun-staging-zdt-release', 'aliyun-staging-zdt-release-standby']);

export const DOCTOR_SCHEMA = 'ai.delivery.readiness-doctor.v1';

export async function doctorCommand(adapter, options, dependencies = {}) {
  const environment = dependencies.environment ?? process.env;
  const sourceSha = String(options.sourceSha ?? '');
  const controlSha = String(options.controlSha ?? '');
  const target = String(options.target ?? '');
  const node = String(options.node ?? options.nodes?.[0] ?? '');
  const repository = String(options.repository ?? environment.GITHUB_REPOSITORY ?? '');
  const baseSha = String(options.baseSha ?? '');
  const request = safeRequest({ sourceSha, controlSha, target, node });
  const requestId = request?.request_id ?? null;
  const secretValues = Object.values(environment).filter((value) => typeof value === 'string');
  const checks = [];
  const errors = [];

  const requestValid = SHA.test(sourceSha) && SHA.test(controlSha) && NAME.test(target) && NAME.test(node)
    && Boolean(adapter.targets?.[target]) && Boolean(adapter.nodes?.[node]?.deployments?.[target]);
  add(checks, 'request-integrity', requestValid ? 'PASS' : 'FAIL', 'request', requestValid
    ? { sourceSha, controlSha, target, physicalNode: node, requestId }
    : { reason: 'full SHAs, known target and real physical deployment are required' });
  if (!requestValid) errors.push(contract('DOCTOR_REQUEST_INVALID', 'CONFIGURATION', 'doctor-request', requestId, 'request', secretValues));

  const token = environment.ZDT_RUNNER_READ_TOKEN ?? '';
  if (!token) {
    add(checks, 'github-observer-token', 'FAIL', 'github-runner-observation', { present: false });
    errors.push(contract('GITHUB_RUNNER_READ_TOKEN_REQUIRED', 'CONFIGURATION', 'doctor-github', requestId,
      'github-runner-observation', secretValues, 'configure-minimal-runner-read-token-and-rerun-doctor'));
  } else {
    try {
      const observed = await (dependencies.githubProbe ?? defaultGithubProbe)({ token, repository, includeClosureHistory: Boolean(baseSha) });
      const latestMatches = !observed.latestControlSha || observed.latestControlSha === controlSha;
      add(checks, 'github-observer-token', latestMatches ? 'PASS' : 'FAIL', 'github-runner-observation', {
        present: true, minimalReadSucceeded: true, latestControlSha: observed.latestControlSha ?? null,
      });
      if (!latestMatches) errors.push(contract('DOCTOR_CONTROL_SHA_NOT_LATEST', 'INTEGRITY_CONFLICT', 'doctor-github', requestId,
        'control-plane-identity', secretValues, 'refresh-origin-zdt-next-and-rerun-doctor'));
      const runners = observed.runners ?? [];
      const states = Object.fromEntries(RUNNERS.map((name) => [name, runners.find((runner) => runner.name === name)?.status ?? 'missing']));
      const fleetVisible = RUNNERS.every((name) => states[name] !== 'missing');
      add(checks, 'runner-fleet', fleetVisible ? 'PASS' : 'FAIL', 'runner-fleet', { states, githubHostedFallback: 'ubuntu-24.04', observationOnly: true });
      if (!fleetVisible) errors.push(contract('RUNNER_FLEET_INCOMPLETE', 'DEPENDENCY_UNAVAILABLE', 'doctor-runner-fleet', requestId,
        'runner-fleet', secretValues, 'repair-runner-visibility-and-rerun-doctor'));
      if (baseSha) {
        const failedClosure = (observed.closureRuns ?? []).some((run) => run.head_sha === sourceSha && run.status === 'completed' && run.conclusion === 'failure');
        add(checks, 'failed-closure-evidence', failedClosure ? 'PASS' : 'FAIL', 'closure-resume', { sourceSha, priorFailedClosure: failedClosure });
        if (!failedClosure) errors.push(contract('FAILED_CLOSURE_EVIDENCE_MISSING', 'CONFIGURATION', 'doctor-resume', requestId,
          'closure-resume', secretValues, 'select-a-source-with-one-failed-closure-and-rerun-doctor'));
      }
    } catch (error) {
      add(checks, 'github-observer-token', 'FAIL', 'github-runner-observation', { present: true, minimalReadSucceeded: false });
      errors.push(deliveryErrorContract(error, { stage: 'doctor-github', requestId, affectedCapability: 'github-runner-observation', secretValues }));
    }
  }

  if (baseSha) {
    try {
      await (dependencies.ancestorProbe ?? assertGitAncestor)(adapter.projectRoot, baseSha, sourceSha);
      add(checks, 'closure-ancestry', 'PASS', 'closure-resume', { baseSha, sourceSha, isAncestor: true });
    } catch (error) {
      add(checks, 'closure-ancestry', 'FAIL', 'closure-resume', { baseSha, sourceSha, isAncestor: false });
      errors.push(deliveryErrorContract(error, { stage: 'doctor-resume', requestId, affectedCapability: 'closure-resume', secretValues }));
    }
  } else add(checks, 'closure-ancestry', 'PASS', 'closure-resume', { requested: false });

  try {
    const workflows = dependencies.workflows ?? await loadWorkflowDocuments(adapter.projectRoot);
    const audit = auditWorkflowSecretContracts(workflows);
    add(checks, 'reusable-secret-contract', audit.ok ? 'PASS' : 'FAIL', 'workflow-secret-chain', { calls: audit.graph, issues: audit.issues });
    for (const issue of audit.issues) errors.push(contract(issue.code, 'CONFIGURATION', 'doctor-workflow-secrets', requestId,
      'workflow-secret-chain', secretValues, 'repair-explicit-secret-contract-and-rerun-doctor', issue));
  } catch (error) {
    add(checks, 'reusable-secret-contract', 'FAIL', 'workflow-secret-chain', { readable: false });
    errors.push(deliveryErrorContract(error, { stage: 'doctor-workflow-secrets', requestId, affectedCapability: 'workflow-secret-chain', secretValues }));
  }

  const missingOss = REQUIRED_OSS.filter((name) => !environment[name]);
  const ossFormatValid = missingOss.length === 0 && /^[A-Za-z0-9][A-Za-z0-9.-]{2,62}$/.test(environment.ALIYUN_OSS_BUCKET)
    && /^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?\/?$/.test(environment.ALIYUN_OSS_ENDPOINT);
  add(checks, 'oss-configuration', ossFormatValid ? 'PASS' : 'FAIL', 'oss-configuration', {
    requiredPresent: missingOss.length === 0, missing: missingOss, bucketConfigured: Boolean(environment.ALIYUN_OSS_BUCKET),
    endpointConfigured: Boolean(environment.ALIYUN_OSS_ENDPOINT), credentialsRedacted: true,
  });
  if (!ossFormatValid) errors.push(contract('OSS_CONFIGURATION_INVALID', 'CONFIGURATION', 'doctor-oss', requestId,
    'oss-configuration', secretValues, 'repair-bucket-endpoint-or-credential-configuration-and-rerun-doctor', { missing: missingOss }));

  if (ossFormatValid && requestValid) {
    const prefix = `${adapter.project}/${target}/${sourceSha}/`;
    try {
      const client = dependencies.ossClient ?? createOssClient({
        accessKeyId: environment.ALIYUN_OSS_ACCESS_KEY_ID, accessKeySecret: environment.ALIYUN_OSS_ACCESS_KEY_SECRET,
        securityToken: environment.ALIYUN_OSS_SECURITY_TOKEN || null, bucket: environment.ALIYUN_OSS_BUCKET, endpoint: environment.ALIYUN_OSS_ENDPOINT,
      }, dependencies.ossDependencies);
      const objects = await client.listPrefix(prefix);
      add(checks, 'oss-read', 'PASS', 'oss-read', { prefix, objectCount: objects.length, operation: 'ListObjectsV2', readOnly: true });
      const finalObjects = objects.filter((object) => object.includes(`/seals/v1/${node}/`) && object.endsWith('/final-seal.json'));
      if (finalObjects.length > 0) await client.getObject(finalObjects[0]);
      add(checks, 'final-seal-read', finalObjects.length > 0 ? 'PASS' : 'UNVERIFIED', 'final-seal-read', {
        readable: finalObjects.length > 0, missingIsNotCreated: true, object: finalObjects[0] ?? null,
      });
    } catch (error) {
      const exactReleaseIndex = `${prefix}release-index-r4-seal-lifecycle.json`;
      add(checks, 'oss-read', 'FAIL', 'oss-read', {
        prefix, operation: 'ListObjectsV2', exactReadAlternative: exactReleaseIndex,
        listStillRequiredFor: ['runner-lease-generation-discovery', 'seal-artifact-digest-discovery', 'writer-renewal-generation-discovery'],
      });
      errors.push(deliveryErrorContract(error, { stage: 'doctor-oss', requestId, affectedCapability: 'oss-read', secretValues,
        details: { prefix, exactHeadGetAlternative: exactReleaseIndex } }));
      add(checks, 'final-seal-read', 'UNVERIFIED', 'final-seal-read', { reason: 'OSS prefix was not readable; no Seal was created' });
    }
  } else {
    add(checks, 'oss-read', 'UNVERIFIED', 'oss-read', { reason: 'request or OSS configuration invalid' });
    add(checks, 'final-seal-read', 'UNVERIFIED', 'final-seal-read', { reason: 'OSS read not attempted' });
  }

  add(checks, 'oss-write-capability', 'UNVERIFIED', 'oss-write', { code: 'UNVERIFIED_WRITE_CAPABILITY', reason: 'Doctor never creates, overwrites or deletes an OSS object' });
  const channel = adapter.nodes?.[node]?.deployments?.[target] ?? null;
  add(checks, 'target-channel', channel ? 'PASS' : 'FAIL', 'target-channel', {
    target, physicalNode: node, pointerRoot: channel?.pointerRoot ?? null, service: channel?.service ?? null,
  });
  const remote = dependencies.remoteProbe ? await dependencies.remoteProbe({ adapter, sourceSha, controlSha, target, node }) : null;
  add(checks, 'production-pointers-and-rollback', remote ? 'PASS' : 'UNVERIFIED', 'production-read', remote ?? {
    current: null, previous: null, reason: 'No read-only remote probe was supplied; Doctor did not open a production write path',
  });

  const failed = checks.some((item) => item.status === 'FAIL');
  const unverified = checks.some((item) => item.status === 'UNVERIFIED');
  return Object.freeze({
    schema: DOCTOR_SCHEMA, version: '1.5.0', project: adapter.project, requestId,
    readiness: failed ? 'BLOCKED' : unverified ? 'READY_WITH_UNVERIFIED_CAPABILITIES' : 'READY', readyForPrepare: !failed,
    checks, errors, boundaries: Object.freeze({ readOnly: true, prepareTriggered: false, sealCreated: false, deployTriggered: false,
      runnerSwitched: false, writerLeaseAcquired: false, productionPointerMoved: false }),
  });
}

async function defaultGithubProbe({ token, repository, includeClosureHistory }) {
  invariant(repository.includes('/'), 'DOCTOR_GITHUB_REPOSITORY_REQUIRED', 'GitHub repository must be owner/name');
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
  const [runnerResponse, branchResponse, closureResponse] = await Promise.all([
    fetch(`https://api.github.com/repos/${repository}/actions/runners?per_page=100`, { headers }),
    fetch(`https://api.github.com/repos/${repository}/commits/zdt-next`, { headers }),
    includeClosureHistory
      ? fetch(`https://api.github.com/repos/${repository}/actions/workflows/auto-prepare-artifacts.yml/runs?branch=zdt-next&per_page=100`, { headers })
      : Promise.resolve(null),
  ]);
  if (!runnerResponse.ok) throw httpError('GITHUB_RUNNER_READ_FAILED', runnerResponse.status);
  if (!branchResponse.ok) throw httpError('GITHUB_CONTROL_SHA_READ_FAILED', branchResponse.status);
  if (closureResponse && !closureResponse.ok) throw httpError('GITHUB_CLOSURE_HISTORY_READ_FAILED', closureResponse.status);
  const runners = await runnerResponse.json();
  const branch = await branchResponse.json();
  const closures = closureResponse ? await closureResponse.json() : { workflow_runs: [] };
  return { runners: runners.runners ?? [], latestControlSha: branch.sha, closureRuns: closures.workflow_runs ?? [] };
}

function httpError(code, status) { const error = new Error(`${code}: HTTP ${status}`); error.code = code; error.status = status; return error; }
function safeRequest(input) { try { return createRunnerRequest({ sourceSha: input.sourceSha, releaseTarget: input.target,
  physicalNode: input.node, controlPlaneSha: input.controlSha }); } catch { return null; } }
function add(checks, id, status, capability, evidence) { checks.push(Object.freeze({ id, status, capability, evidence })); }
function contract(code, category, stage, requestId, affectedCapability, secretValues, nextSafeAction, details = {}) {
  const error = new Error(code); error.code = code;
  return deliveryErrorContract(error, { category, stage, requestId, affectedCapability, secretValues, nextSafeAction, details });
}
