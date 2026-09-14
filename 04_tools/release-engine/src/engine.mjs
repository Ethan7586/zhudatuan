import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { cp, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import { materializeTarget, packageTarget, resolvePackageArtifactPaths } from './artifact.mjs';
import { resolveDeployment } from './adapter.mjs';
import { DeliveryError, invariant } from './errors.mjs';
import { assertBuildRefIsCheckedOut, assertWorktreeClean, currentHead } from './git.mjs';
import { layerCommand } from './layer.mjs';
import { acquireLocks } from './lock.mjs';
import { ossClientFromEnvironment, publishPreparedArtifact, resolveDownloadEndpoint, resolvePreparedArtifact } from './oss.mjs';
import { createPlan } from './planner.mjs';
import { runCommand } from './runner.mjs';
import { createRun, readJson, statePaths, writeJson } from './state.mjs';

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

export async function planCommand(adapter, options) {
  const started = performance.now();
  const created = await createPlan(adapter, options);
  const plan = { ...created, timings: { plan: elapsed(started) } };
  const run = await createRun(adapter, plan);
  return { ...plan, runId: run.runId, planPath: join(run.directory, 'plan.json') };
}

export async function buildCommand(adapter, options) {
  const started = performance.now();
  const planPath = requiredPath(options.plan, 'BUILD_PLAN_REQUIRED');
  const plan = await readJson(planPath);
  invariant(plan.project === adapter.project, 'BUILD_PROJECT_MISMATCH', 'Plan belongs to another project');
  invariant(plan.deployRequired || plan.requiredValidations?.length > 0, 'BUILD_NOT_REQUIRED', 'Plan contains no deployable changes or required validations');
  await assertBuildRefIsCheckedOut(adapter.projectRoot, plan.to.sha);
  const runDirectory = dirname(planPath);
  const paths = statePaths(adapter);
  const release = await acquireLocks([join(paths.locks, 'build', `${plan.to.sha}.lock`)], {
    project: adapter.project,
    phase: 'build',
    sourceSha: plan.to.sha,
  });
  const phases = { preflight: [], tests: [], typecheck: [], build: [] };
  const timings = { preflight: 0, tests: 0, typecheck: 0, build: 0, materialize: 0 };
  const targetEvidence = [];
  try {
    for (const phase of ['preflight', 'tests', 'typecheck', 'build']) {
      let index = 0;
      for (const command of plan.actions[phase]) {
        const result = await runCommand(command, commandContext(adapter, plan, runDirectory, command.target, `${phase}-${index++}-${command.name}`));
        phases[phase].push(result);
        timings[phase] += result.durationMs;
      }
    }
    const materializeStarted = performance.now();
    for (const target of plan.deploymentOrder ?? plan.targets) targetEvidence.push(await materializeTarget(adapter, target, runDirectory, plan.changes));
    timings.materialize = elapsed(materializeStarted);
    timings.total = elapsed(started);
    const evidence = {
      schema: 'ai.delivery.build.v1',
      project: adapter.project,
      runId: plan.runId ?? basename(runDirectory),
      sourceSha: plan.to.sha,
      planDigest: plan.planDigest,
      phases,
      targets: targetEvidence,
      timings,
      completedAt: new Date().toISOString(),
    };
    await writeJson(join(runDirectory, 'build.json'), evidence);
    return { ...evidence, buildPath: join(runDirectory, 'build.json') };
  } finally {
    await release();
  }
}

export async function packageCommand(adapter, options) {
  const started = performance.now();
  const buildPath = requiredPath(options.build, 'PACKAGE_BUILD_REQUIRED');
  const build = await readJson(buildPath);
  const runDirectory = dirname(buildPath);
  const plan = await readJson(join(runDirectory, 'plan.json'));
  invariant(build.sourceSha === plan.to.sha, 'PACKAGE_SOURCE_MISMATCH', 'Build and plan source differ');
  const state = statePaths(adapter);
  const artifacts = [];
  for (const target of build.targets) artifacts.push(await packageTarget(adapter, plan, target, runDirectory, state.artifacts));
  const result = {
    schema: 'ai.delivery.package-set.v1',
    project: adapter.project,
    runId: build.runId,
    stateRoot: state.root,
    sourceSha: build.sourceSha,
    direct: plan.direct === true,
    prepare: plan.prepare === true,
    requestedTargets: plan.requestedTargets ?? [],
    targetScope: plan.targetScope ?? { mode: 'affected', requestedTargets: [], excludedChangeCount: 0 },
    deploymentOrder: plan.deploymentOrder ?? build.targets.map((target) => target.target),
    artifacts,
    timings: { package: elapsed(started), total: elapsed(started) },
    completedAt: new Date().toISOString(),
  };
  await writeJson(join(runDirectory, 'package.json'), result);
  return { ...result, packagePath: join(runDirectory, 'package.json') };
}

export async function publishCommand(adapter, options) {
  return publishPreparedArtifact(adapter, options);
}

export async function validatePreparedCommand(adapter, options) {
  return preparedArtifactCommand(adapter, options, true);
}

export async function deployPreparedCommand(adapter, options) {
  return preparedArtifactCommand(adapter, options, false);
}

export async function registerCurrentBaselineCommand(adapter, options) {
  const sourceSha = required(options.sourceSha, 'CURRENT_BASELINE_SOURCE_SHA_REQUIRED');
  const controlSha = required(options.controlSha, 'CURRENT_BASELINE_CONTROL_SHA_REQUIRED');
  const nodeKey = required(options.node ?? options.nodes?.[0], 'CURRENT_BASELINE_NODE_REQUIRED');
  const targetId = required(options.target, 'CURRENT_BASELINE_TARGET_REQUIRED');
  const artifactSha256 = required(options.legacyArtifactSha256, 'CURRENT_BASELINE_ARTIFACT_SHA256_REQUIRED');
  const legacyRunId = required(options.legacyRunId, 'CURRENT_BASELINE_LEGACY_RUN_ID_REQUIRED');
  const legacyRunAttempt = required(options.legacyRunAttempt, 'CURRENT_BASELINE_LEGACY_RUN_ATTEMPT_REQUIRED');
  const requestedExpectedCurrent = options.expectedCurrent;
  const repository = required(options.repository ?? process.env.GITHUB_REPOSITORY, 'CURRENT_BASELINE_REPOSITORY_REQUIRED');
  const githubRunId = required(options.githubRunId, 'CURRENT_BASELINE_CONTROL_RUN_ID_REQUIRED');
  const githubRunAttempt = required(options.githubRunAttempt, 'CURRENT_BASELINE_CONTROL_RUN_ATTEMPT_REQUIRED');
  const expectedRemoteAgentSha256 = required(options.expectedRemoteAgentSha256, 'CURRENT_BASELINE_REMOTE_AGENT_SHA256_REQUIRED');
  const expectedRemotePolicySha256 = required(options.expectedRemotePolicySha256, 'CURRENT_BASELINE_REMOTE_POLICY_SHA256_REQUIRED');
  invariant(/^[a-f0-9]{40}$/.test(sourceSha) && /^[a-f0-9]{40}$/.test(controlSha), 'CURRENT_BASELINE_SOURCE_INVALID', 'Baseline source and control plane must be full lowercase Git SHAs');
  invariant(/^[a-f0-9]{64}$/.test(artifactSha256), 'CURRENT_BASELINE_ARTIFACT_SHA256_INVALID', 'Legacy artifact SHA-256 must be 64 lowercase hexadecimal characters');
  invariant(/^[1-9][0-9]*$/.test(legacyRunId) && /^[1-9][0-9]*$/.test(legacyRunAttempt), 'CURRENT_BASELINE_LEGACY_RUN_INVALID', 'Legacy run id and attempt must be positive integers');
  invariant(/^[1-9][0-9]*$/.test(githubRunId) && /^[1-9][0-9]*$/.test(githubRunAttempt), 'CURRENT_BASELINE_CONTROL_RUN_INVALID', 'Control-plane run id and attempt must be positive integers');
  invariant(SHA256_PATTERN.test(expectedRemoteAgentSha256) && SHA256_PATTERN.test(expectedRemotePolicySha256), 'CURRENT_BASELINE_REMOTE_DIGEST_INVALID', 'Expected remote Agent and policy digests are required');
  const node = adapter.nodes[nodeKey];
  const deployment = node?.deployments?.[targetId];
  invariant(Boolean(deployment), 'CURRENT_BASELINE_TARGET_UNKNOWN', `Unknown deployment ${nodeKey}/${targetId}`);
  const releaseId = `${sourceSha.slice(0, 12)}-${artifactSha256.slice(0, 16)}`;
  const expectedCurrent = join(deployment.pointerRoot, 'releases', releaseId);
  if (requestedExpectedCurrent !== undefined) invariant(requestedExpectedCurrent === expectedCurrent, 'CURRENT_BASELINE_EXPECTED_PATH_MISMATCH', 'Requested current path differs from the deployment adapter');

  const metadataResult = await runCommand(
    { name: 'read-legacy-deployment-run', argv: ['gh', 'api', `repos/${repository}/actions/runs/${legacyRunId}`], timeoutMs: 60_000 },
    basicContext(adapter)
  );
  const logResult = await runCommand(
    { name: 'read-legacy-deployment-log', argv: ['gh', 'run', 'view', legacyRunId, '--repo', repository, '--log'], timeoutMs: 60_000 },
    basicContext(adapter)
  );
  const lineageResult = await runCommand(
    { name: 'verify-current-baseline-lineage', argv: ['gh', 'api', `repos/${repository}/compare/${sourceSha}...${controlSha}`, '--jq', '.merge_base_commit.sha'], timeoutMs: 60_000 },
    basicContext(adapter)
  );
  invariant(lineageResult.output.trim() === sourceSha, 'CURRENT_BASELINE_SOURCE_NOT_ON_MAINLINE', 'Legacy production source is not contained in the current zdt-next control-plane history');
  const legacyEvidence = assertLegacyDeploymentEvidence(JSON.parse(metadataResult.output), logResult.output, {
    sourceSha,
    target: targetId,
    artifactSha256,
    expectedCurrent,
    legacyRunId,
    legacyRunAttempt,
  });

  const transport = node.transport ?? adapter.transport;
  invariant(transport.kind === 'ssh', 'CURRENT_BASELINE_REQUIRES_REMOTE_POLICY', 'Current baseline registration requires the remote policy');
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(Boolean(host), 'DEPLOY_SSH_HOST_MISSING', `SSH host missing for ${nodeKey}`);
  const remoteAgent = transport.agent ?? '/usr/local/lib/ai-delivery/agent.mjs';
  const approval = `${adapter.project}:register-current-baseline:${sourceSha}:${artifactSha256}`;
  const result = await runCommand(
    {
      name: `register-current-baseline:${nodeKey}:${targetId}`,
      argv: [
        'ssh', host, remoteAgent, 'register-current-baseline-v3',
        '--project', adapter.project,
        '--node', nodeKey,
        '--target', targetId,
        '--source-sha', sourceSha,
        '--legacy-artifact-sha256', artifactSha256,
        '--legacy-run-id', legacyRunId,
        '--legacy-run-attempt', legacyRunAttempt,
        '--legacy-workflow-path', legacyEvidence.workflowPath,
        '--expected-current', expectedCurrent,
        '--approval', approval,
        '--control-sha', controlSha,
        '--github-run-id', githubRunId,
        '--github-run-attempt', githubRunAttempt,
        '--expected-remote-agent-sha256', expectedRemoteAgentSha256,
        '--expected-remote-policy-sha256', expectedRemotePolicySha256,
      ],
      timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
    },
    basicContext(adapter)
  );
  const remote = parseCommandJson(result)?.result;
  invariant(remote?.schema === 'ai.delivery.current-baseline-registration.v1' && remote.current?.unchanged === true && remote.process?.unchanged === true, 'CURRENT_BASELINE_RECEIPT_INVALID', 'Remote baseline registration did not prove pointer and process stability');
  return { schema: 'ai.delivery.current-baseline.v1', project: adapter.project, node: nodeKey, target: targetId, sourceSha, legacyEvidence, remote, durationMs: result.durationMs };
}

export function assertLegacyDeploymentEvidence(metadata, log, expected) {
  invariant(String(metadata?.id) === expected.legacyRunId, 'CURRENT_BASELINE_LEGACY_RUN_MISMATCH', 'Legacy deployment run id differs');
  invariant(metadata?.head_sha === expected.sourceSha && metadata?.conclusion === 'success' && metadata?.event === 'workflow_dispatch', 'CURRENT_BASELINE_LEGACY_RUN_UNTRUSTED', 'Legacy deployment run is not a successful exact-source manual release');
  const legacyWorkflowPaths = new Set(['.github/workflows/deploy-oss.yml', '.github/workflows/legacy-oss-recovery-aliyun.yml']);
  invariant(legacyWorkflowPaths.has(metadata?.path) && String(metadata?.run_attempt) === expected.legacyRunAttempt, 'CURRENT_BASELINE_LEGACY_WORKFLOW_MISMATCH', 'Legacy deployment workflow or attempt differs');
  const releaseId = `${expected.sourceSha.slice(0, 12)}-${expected.artifactSha256.slice(0, 16)}`;
  invariant(expected.expectedCurrent.endsWith(`/releases/${releaseId}`), 'CURRENT_BASELINE_EXPECTED_PATH_INVALID', 'Expected current path does not encode the exact legacy source and artifact');
  invariant(log.includes(`SOURCE_SHA=${expected.sourceSha}`), 'CURRENT_BASELINE_LEGACY_SOURCE_RECEIPT_MISSING', 'Legacy deployment log does not contain the exact source receipt');
  invariant(log.includes(`CURRENT_${expected.target}=${expected.expectedCurrent}`), 'CURRENT_BASELINE_LEGACY_TARGET_RECEIPT_MISSING', 'Legacy deployment log does not contain the exact target pointer receipt');
  invariant(log.includes(`/${expected.artifactSha256}.tar.gz`), 'CURRENT_BASELINE_LEGACY_ARTIFACT_RECEIPT_MISSING', 'Legacy deployment log does not contain the exact artifact object');
  return {
    workflowPath: metadata.path,
    runId: expected.legacyRunId,
    runAttempt: expected.legacyRunAttempt,
    sourceSha: expected.sourceSha,
    artifactSha256: `sha256:${expected.artifactSha256}`,
    current: expected.expectedCurrent,
  };
}

async function preparedArtifactCommand(adapter, options, candidateOnly) {
  const started = performance.now();
  const sourceSha = required(options.sourceSha, 'PREPARED_DEPLOY_SOURCE_SHA_REQUIRED');
  invariant(/^[a-f0-9]{40}$/.test(sourceSha), 'PREPARED_DEPLOY_SOURCE_SHA_INVALID', 'Prepared deploy requires one full lowercase Git commit SHA');
  const controlSha = required(options.controlSha, 'PREPARED_DEPLOY_CONTROL_SHA_REQUIRED');
  const githubRunId = required(options.githubRunId, 'PREPARED_DEPLOY_RUN_ID_REQUIRED');
  const githubRunAttempt = required(options.githubRunAttempt, 'PREPARED_DEPLOY_RUN_ATTEMPT_REQUIRED');
  invariant(/^[a-f0-9]{40}$/.test(controlSha), 'PREPARED_DEPLOY_CONTROL_SHA_INVALID', 'Prepared deploy requires the exact release control-plane SHA');
  invariant(/^[1-9][0-9]*$/.test(githubRunId), 'PREPARED_DEPLOY_RUN_ID_INVALID', 'Prepared deploy requires the GitHub run id');
  invariant(/^[1-9][0-9]*$/.test(githubRunAttempt), 'PREPARED_DEPLOY_RUN_ATTEMPT_INVALID', 'Prepared deploy requires the GitHub run attempt');
  const expectedRemoteAgentSha256 = required(options.expectedRemoteAgentSha256, 'PREPARED_DEPLOY_REMOTE_AGENT_SHA256_REQUIRED');
  const expectedRemotePolicySha256 = required(options.expectedRemotePolicySha256, 'PREPARED_DEPLOY_REMOTE_POLICY_SHA256_REQUIRED');
  invariant(SHA256_PATTERN.test(expectedRemoteAgentSha256), 'PREPARED_DEPLOY_REMOTE_AGENT_SHA256_INVALID', 'Prepared deploy requires the expected remote Agent SHA-256');
  invariant(SHA256_PATTERN.test(expectedRemotePolicySha256), 'PREPARED_DEPLOY_REMOTE_POLICY_SHA256_INVALID', 'Prepared deploy requires the expected remote policy SHA-256');
  const target = required(options.target, 'PREPARED_DEPLOY_TARGET_REQUIRED');
  invariant(Boolean(adapter.targets[target]), 'PREPARED_DEPLOY_TARGET_UNKNOWN', `Unknown target ${target}`);
  const nodes = options.nodes ?? [];
  invariant(nodes.length === 1, 'PREPARED_DEPLOY_NODE_REQUIRED', 'Prepared deploy requires exactly one explicit node');
  const requestedNode = nodes[0];
  invariant(Boolean(adapter.nodes[requestedNode]?.deployments?.[target]), 'PREPARED_DEPLOY_NODE_TARGET_MISMATCH', `Unknown deployment ${requestedNode}/${target}`);
  const resolvedDeployment = resolveDeployment(adapter, requestedNode, target);
  const resolution = await resolvePreparedArtifact(adapter, { ...options, node: requestedNode });
  const publicClient = ossClientFromEnvironment(options.endpoint);
  const downloadEndpoint = resolveDownloadEndpoint(publicClient.endpoint, options.internalEndpoint ?? process.env.ALIYUN_OSS_INTERNAL_ENDPOINT);
  const downloadClient = ossClientFromEnvironment(downloadEndpoint);
  const transport = resolvedDeployment.node.transport ?? adapter.transport;
  invariant(transport?.kind === 'ssh', 'PREPARED_DEPLOY_REQUIRES_SSH', 'Prepared deploy requires the declared SSH transport');
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(Boolean(host), 'DEPLOY_SSH_HOST_MISSING', `SSH host missing for ${resolvedDeployment.executionNode}`);
  const remoteAgent = transport.agent ?? '/usr/local/lib/ai-delivery/agent.mjs';
  const artifact = resolution.manifest.artifact;
  const runtimeManifest = resolution.manifest.runtimeManifest;
  const remoteAction = candidateOnly ? 'validate-oss-candidate-v3' : 'deploy-sealed-candidate-v3';
  const remoteIdentityArgs = [
    '--project',
    adapter.project,
    '--node',
    resolvedDeployment.executionNode,
    '--target',
    target,
    '--source-sha',
    sourceSha,
    '--sha256',
    artifact.sha256.slice(7),
    '--tree-digest',
    artifact.treeDigest,
    '--manifest-digest',
    runtimeManifest.manifestDigest,
    '--control-sha',
    controlSha,
    '--github-run-id',
    githubRunId,
    '--github-run-attempt',
    githubRunAttempt,
    '--expected-remote-agent-sha256',
    expectedRemoteAgentSha256,
    '--expected-remote-policy-sha256',
    expectedRemotePolicySha256,
  ];
  const remoteStarted = performance.now();
  const remote = await runCommand(
    {
      name: `${candidateOnly ? 'validate' : 'deploy'}-prepared:${resolvedDeployment.executionNode}:${target}`,
      argv: [
        'ssh',
        host,
        remoteAgent,
        remoteAction,
        ...remoteIdentityArgs,
      ],
      ...(candidateOnly
        ? {
            input: `${JSON.stringify({
              artifactUrl: downloadClient.signGet(artifact.object, 900),
              manifestUrl: downloadClient.signGet(runtimeManifest.object, 900),
            })}\n`,
          }
        : {}),
      timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
    },
    basicContext(adapter)
  );
  const remoteResult = parseCommandJson(remote)?.result;
  let lineage = null;
  let candidateSeal = null;
  if (candidateOnly) {
    invariant(remoteResult?.schema === 'ai.delivery.oss-candidate.v1' && remoteResult.current?.unchanged === true, 'PREPARED_CANDIDATE_EVIDENCE_MISSING', 'Remote prepared candidate validation did not prove current remained unchanged');
    lineage = await verifyPreparedSourceLineage(adapter, options, remoteResult.current, sourceSha);
    const sealed = await runCommand(
      {
        name: `seal-prepared:${resolvedDeployment.executionNode}:${target}`,
        argv: [
          'ssh',
          host,
          remoteAgent,
          'seal-validated-candidate-v3',
          ...remoteIdentityArgs,
          '--expected-current',
          remoteResult.current.after ?? 'none',
          '--expected-current-source-sha',
          remoteResult.current.sourceSha ?? 'none',
        ],
        timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
      },
      basicContext(adapter)
    );
    candidateSeal = parseCommandJson(sealed)?.result;
    invariant(candidateSeal?.schema === 'ai.delivery.candidate-seal.v1', 'PREPARED_CANDIDATE_SEAL_MISSING', 'Remote candidate seal was not recorded');
  } else {
    invariant(Boolean(remoteResult?.activation?.receipt), 'PREPARED_DEPLOY_RECEIPT_MISSING', 'Remote prepared deploy did not return an activation receipt');
  }
  const controlPlane = candidateOnly ? remoteResult.controlPlane : remoteResult.activation.receipt.controlPlane;
  assertPreparedControlPlane(controlPlane, {
    sourceSha: controlSha,
    githubRunId,
    githubRunAttempt,
    remoteAgentSha256: expectedRemoteAgentSha256,
    remotePolicySha256: expectedRemotePolicySha256,
  });
  return {
    schema: candidateOnly ? 'ai.delivery.prepared-candidate.v1' : 'ai.delivery.prepared-deploy.v1',
    project: adapter.project,
    sourceSha,
    artifactSourceSha: sourceSha,
    controlPlane,
    target,
    requestedNode,
    node: resolvedDeployment.executionNode,
    artifactIdentity: artifact.sha256,
    releaseManifestObject: resolution.releaseManifestObject,
    finalStatus: candidateOnly ? 'candidate-validated' : 'success',
    cacheStatus: remoteResult.cacheStatus,
    repeatedDeployment: candidateOnly ? false : remoteResult.activation.alreadyCurrent === true,
    timings: {
      artifactLookup: resolution.timings.artifactLookup,
      download: remoteResult.timings?.download ?? 0,
      candidate: remoteResult.timings?.candidate ?? 0,
      cutover: remoteResult.activation?.timings?.cutover ?? 0,
      restart: remoteResult.activation?.timings?.restart ?? 0,
      health: remoteResult.activation?.timings?.health ?? 0,
      rollback: remoteResult.timings?.rollback ?? 0,
      remoteTotal: elapsed(remoteStarted),
      total: elapsed(started),
    },
    traffic: {
      artifactBytes: artifact.bytes + runtimeManifest.bytes,
      downloadedBytes: remoteResult.downloadedBytes ?? 0,
      reusedBytes: remoteResult.reusedBytes ?? 0,
    },
    ...(candidateOnly ? { candidateEvidence: remoteResult.current, candidateSeal, lineage } : { receipt: remoteResult.activation.receipt, candidateSeal: remoteResult.seal }),
    completedAt: new Date().toISOString(),
  };
}

async function verifyPreparedSourceLineage(adapter, options, current, candidateSourceSha) {
  const repository = required(options.repository ?? process.env.GITHUB_REPOSITORY, 'PREPARED_REPOSITORY_REQUIRED');
  if (!current?.after) return assertPreparedSourceLineage(current, candidateSourceSha, null);
  invariant(/^[a-f0-9]{40}$/.test(current.sourceSha ?? ''), 'PREPARED_CURRENT_SOURCE_UNAVAILABLE', 'Current production release has no verifiable source SHA');
  const comparison = await runCommand(
    {
      name: 'verify-prepared-source-lineage',
      argv: ['gh', 'api', `repos/${repository}/compare/${current.sourceSha}...${candidateSourceSha}`, '--jq', '.merge_base_commit.sha'],
      timeoutMs: 60_000,
    },
    basicContext(adapter)
  );
  return assertPreparedSourceLineage(current, candidateSourceSha, comparison.output.trim());
}

export function assertPreparedSourceLineage(current, candidateSourceSha, mergeBaseSha) {
  invariant(/^[a-f0-9]{40}$/.test(candidateSourceSha), 'PREPARED_DEPLOY_SOURCE_SHA_INVALID', 'Candidate source SHA is invalid');
  if (!current?.after) {
    invariant(current?.sourceSha == null, 'PREPARED_CURRENT_SOURCE_UNEXPECTED', 'Missing current pointer reported a source SHA');
    return { status: 'first-activation', currentSourceSha: null, candidateSourceSha };
  }
  invariant(/^[a-f0-9]{40}$/.test(current.sourceSha ?? ''), 'PREPARED_CURRENT_SOURCE_UNAVAILABLE', 'Current production release has no verifiable source SHA');
  invariant(mergeBaseSha === current.sourceSha, 'PREPARED_SOURCE_DOES_NOT_CONTAIN_CURRENT', 'Candidate source does not contain the current production source', {
    currentSourceSha: current.sourceSha,
    candidateSourceSha,
    mergeBaseSha,
  });
  return { status: 'verified', currentSourceSha: current.sourceSha, candidateSourceSha, mergeBaseSha };
}

export function assertPreparedControlPlane(controlPlane, expected) {
  invariant(
    controlPlane?.sourceSha === expected.sourceSha && controlPlane.github?.runId === expected.githubRunId && controlPlane.github?.runAttempt === expected.githubRunAttempt,
    'PREPARED_DEPLOY_CONTROL_PROVENANCE_MISMATCH',
    'Remote deployment receipt control-plane provenance differs'
  );
  invariant(
    SHA256_PATTERN.test(controlPlane.remoteAgentSha256 ?? '') && SHA256_PATTERN.test(controlPlane.remotePolicySha256 ?? ''),
    'PREPARED_DEPLOY_REMOTE_PROVENANCE_MISSING',
    'Remote deployment receipt is missing Agent or policy digest'
  );
  invariant(
    controlPlane.remoteAgentSha256 === expected.remoteAgentSha256 && controlPlane.remotePolicySha256 === expected.remotePolicySha256,
    'PREPARED_DEPLOY_REMOTE_PROVENANCE_MISMATCH',
    'Remote Agent or policy digest differs from the exact release control plane',
    {
      expected: { remoteAgentSha256: expected.remoteAgentSha256, remotePolicySha256: expected.remotePolicySha256 },
      actual: { remoteAgentSha256: controlPlane.remoteAgentSha256, remotePolicySha256: controlPlane.remotePolicySha256 },
    }
  );
  return controlPlane;
}

export async function deployCommand(adapter, options) {
  const started = performance.now();
  const packagePath = requiredPath(options.package, 'DEPLOY_PACKAGE_REQUIRED');
  const packageSet = await resolvePackageArtifactPaths(packagePath, await readJson(packagePath));
  invariant(packageSet.project === adapter.project, 'DEPLOY_PROJECT_MISMATCH', 'Package belongs to another project');
  const direct = options.direct === true;
  const nodes = options.nodes ?? [];
  if (direct) {
    invariant(typeof options.target === 'string' && options.target.length > 0, 'DIRECT_TARGET_REQUIRED', 'Direct delivery requires exactly one explicit target');
    invariant(nodes.length === 1, 'DIRECT_NODE_REQUIRED', 'Direct delivery requires exactly one explicit node');
    invariant(/^[a-f0-9]{40}$/.test(packageSet.sourceSha ?? ''), 'DIRECT_SHA_REQUIRED', 'Direct delivery package requires one full lowercase Git commit SHA');
  }
  const requestedTargets = options.target === undefined ? [] : deploymentTargetClosure(adapter, options.target);
  if (options.target !== undefined) {
    invariant(Boolean(adapter.targets[options.target]), 'DEPLOY_TARGET_UNKNOWN', `Unknown target ${options.target}`);
    invariant(
      packageSet.artifacts.some((artifact) => artifact.target === options.target),
      'DEPLOY_TARGET_NOT_PACKAGED',
      `Package does not contain target ${options.target}`
    );
  }
  invariant(!direct || requestedTargets.length === 1, 'DIRECT_SCOPE_EXPANSION_FORBIDDEN', 'Direct delivery cannot expand beyond the one requested target', { requestedTargets });
  const artifacts = requestedTargets.length > 0 ? packageSet.artifacts.filter((artifact) => requestedTargets.includes(artifact.target)) : packageSet.artifacts;
  invariant(nodes.length > 0, 'DEPLOY_NODE_REQUIRED', 'Deploy requires at least one explicit --node');
  const environment = options.environment ?? 'candidate';
  invariant(['candidate', 'production'].includes(environment), 'DEPLOY_ENVIRONMENT_INVALID', 'Environment must be candidate or production');
  if (environment === 'production' && !direct) {
    const expected = `${adapter.project}:${packageSet.sourceSha}`;
    invariant(options.approveProduction === expected, 'PRODUCTION_APPROVAL_REQUIRED', `Production requires --approve-production ${expected}`);
  }
  const deployments = new Map();
  const order = new Map((packageSet.deploymentOrder ?? artifacts.map((artifact) => artifact.target)).map((target, index) => [target, index]));
  for (const requestedNode of nodes) {
    invariant(Boolean(adapter.nodes[requestedNode]), 'DEPLOY_NODE_UNKNOWN', `Unknown node ${requestedNode}`);
    for (const artifact of [...artifacts].sort((left, right) => (order.get(left.target) ?? 0) - (order.get(right.target) ?? 0))) {
      const resolved = resolveDeployment(adapter, requestedNode, artifact.target);
      const { executionNode: nodeKey, node, deployment } = resolved;
      const key = `${nodeKey}:${artifact.target}`;
      const existing = deployments.get(key);
      if (existing) {
        existing.requestedNodes.push(requestedNode);
      } else {
        deployments.set(key, { nodeKey, node, artifact, deployment, requestedNodes: [requestedNode] });
      }
    }
  }
  invariant(deployments.size > 0, 'DEPLOY_NO_TARGETS', 'The selected package has no target for the requested node(s)', { nodes });
  const paths = statePaths(adapter);
  const results = [];
  const failedMigrations = new Set();
  for (const item of deployments.values()) {
    const blockers = environment === 'production' ? (adapter.targets[item.artifact.target]?.after ?? []).filter((target) => failedMigrations.has(target)) : [];
    if (blockers.length > 0) {
      results.push({
        ok: false,
        skipped: true,
        node: item.nodeKey,
        target: item.artifact.target,
        environment,
        error: { code: 'DATABASE_MIGRATION_DEPENDENCY_FAILED', message: 'Consumer activation blocked by failed database migration', details: { blockers } },
      });
      continue;
    }
    const release = await acquireLocks([join(paths.locks, 'nodes', `${item.nodeKey}.lock`), join(paths.locks, 'targets', item.nodeKey, `${item.artifact.target}.lock`)], {
      project: adapter.project,
      phase: `deploy:${environment}`,
      sourceSha: packageSet.sourceSha,
      node: item.nodeKey,
      target: item.artifact.target,
      service: item.deployment.service,
    });
    try {
      results.push({ ok: true, ...(await executeDeployment(adapter, item, environment, options)) });
    } catch (error) {
      results.push({ ok: false, node: item.nodeKey, target: item.artifact.target, environment, error: { code: error.code ?? 'DEPLOYMENT_FAILED', message: error.message, details: error.details ?? {} } });
      if (environment === 'production' && adapter.targets[item.artifact.target]?.kind === 'migration') failedMigrations.add(item.artifact.target);
    } finally {
      await release();
    }
  }
  const successful = results.filter((item) => item.ok && !item.skipped);
  const timings = aggregateDeployTimings(successful);
  timings.package = packageSet.timings?.package ?? 0;
  timings.total = elapsed(started);
  const result = {
    schema: 'ai.delivery.deploy.v1',
    project: adapter.project,
    environment,
    sourceSha: packageSet.sourceSha,
    requestedTargets: options.target === undefined ? [] : [options.target],
    finalStatus: results.every((item) => item.ok) ? 'success' : successful.length > 0 ? 'partial-failure' : 'failure',
    results,
    timings,
    traffic: aggregateDeployTraffic(successful),
    completedAt: new Date().toISOString(),
  };
  await writeJson(join(dirname(packagePath), `deploy-${environment}.json`), result);
  invariant(result.finalStatus === 'success', 'DEPLOYMENT_OBJECTS_FAILED', 'One or more independently locked deployment objects failed', result);
  return result;
}

function deploymentTargetClosure(adapter, targetId) {
  const selected = new Set([targetId]);
  const visit = (target) => {
    for (const dependency of adapter.targets[target]?.requires ?? []) {
      if (selected.has(dependency)) continue;
      selected.add(dependency);
      visit(dependency);
    }
  };
  visit(targetId);
  return [...selected];
}

export async function installCommand(adapter, options) {
  const started = performance.now();
  const mode = options.mode ?? 'agent';
  invariant(['agent-candidate', 'agent', 'runtime-candidate', 'runtime', 'verify'].includes(mode), 'INSTALL_MODE_INVALID', `Unsupported install mode: ${mode}`);
  const nodeScope = ['runtime-candidate', 'runtime'].includes(mode) ? required(options.node, 'INSTALL_NODE_REQUIRED') : 'all';
  invariant(nodeScope === 'all' || Boolean(adapter.nodes[nodeScope]), 'INSTALL_NODE_UNKNOWN', `Unknown install node: ${nodeScope}`);
  await assertWorktreeClean(adapter.projectRoot);
  const head = await currentHead(adapter.projectRoot);
  if (options.sourceSha) invariant(options.sourceSha === head, 'INSTALL_SOURCE_SHA_MISMATCH', 'Installation source must be the checked-out commit', { head, requested: options.sourceSha });
  await assertBuildRefIsCheckedOut(adapter.projectRoot, head);
  const expected = `${adapter.project}:install:${head}`;
  invariant(options.approveInstall === expected, 'INSTALL_APPROVAL_REQUIRED', `Install requires --approve-install ${expected}`);
  const transport = adapter.transport;
  invariant(transport?.kind === 'ssh', 'INSTALL_REQUIRES_SSH', 'Production installation requires the declared SSH transport');
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(Boolean(host), 'DEPLOY_SSH_HOST_MISSING', 'SSH host missing for production installation');
  const bundleFiles = [
    '04_tools/release-engine/remote/agent.mjs',
    '02_platform_pingtai/infrastructure/release/install-ai-delivery-agent.sh',
    '02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json',
    '02_platform_pingtai/config/node-runtime/hbbtzn-l1/api-gateway.Caddyfile',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/ecosystem.config.cjs',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-api-gateway@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-storefront@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-identity-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-identity-notification-jobs@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-mall-provisioning-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-purchase-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-web-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-catalog-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-catalog-jobs@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-payment-webhook-api@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-payment-jobs@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-console-support.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-api.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-purchase-api.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-web-api.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-catalog-api.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-catalog-jobs.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-payment-webhook-api.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-payment-jobs.service',
  ];
  const paths = statePaths(adapter);
  const bundleDirectory = join(paths.root, 'bootstrap', head);
  await mkdir(bundleDirectory, { recursive: true });
  const archive = join(bundleDirectory, `install-${mode}.tar.gz`);
  const packageStarted = performance.now();
  await runCommand({ name: `install-package:${mode}`, argv: ['tar', '-czf', archive, '-C', adapter.projectRoot, ...bundleFiles], timeoutMs: 120_000 }, basicContext(adapter));
  const packageMs = elapsed(packageStarted);
  const archiveBytes = (await lstat(archive)).size;
  const archiveSha256 = await hashLocalFile(archive);
  const remoteArchive = `/tmp/ai-delivery-install-${head}-${archiveSha256}.tar.gz`;
  const remoteRoot = `/opt/ai-delivery/bootstrap/${head}-${archiveSha256}`;
  const upload = await runCommand({ name: `install-upload:${mode}`, argv: ['scp', archive, `${host}:${remoteArchive}`], timeoutMs: transport.uploadTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
  const remoteHash = await runCommand({ name: `install-hash:${mode}`, argv: ['ssh', host, 'sha256sum', remoteArchive], timeoutMs: 30_000 }, basicContext(adapter));
  invariant(remoteHash.output.trim().split(/\s+/)[0] === archiveSha256, 'INSTALL_ARCHIVE_HASH_MISMATCH', 'Remote installation archive hash differs');
  await runCommand({ name: `install-directory:${mode}`, argv: ['ssh', host, 'mkdir', '-p', remoteRoot], timeoutMs: 30_000 }, basicContext(adapter));
  await runCommand({ name: `install-extract:${mode}`, argv: ['ssh', host, 'tar', '-xzf', remoteArchive, '-C', remoteRoot], timeoutMs: 120_000 }, basicContext(adapter));
  const installed = await runCommand(
    {
      name: `install-apply:${mode}`,
      argv: ['ssh', host, 'flock', '-n', `/run/lock/ai-delivery/${adapter.project}-bootstrap.lock`, 'bash', `${remoteRoot}/02_platform_pingtai/infrastructure/release/install-ai-delivery-agent.sh`, mode, remoteRoot, nodeScope],
      timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
    },
    basicContext(adapter)
  );
  await runCommand({ name: `install-cleanup:${mode}`, argv: ['ssh', host, 'rm', '-f', remoteArchive], timeoutMs: 30_000 }, basicContext(adapter));
  return {
    schema: 'ai.delivery.install.v1',
    project: adapter.project,
    mode,
    node: nodeScope,
    sourceSha: head,
    archive: { path: archive, bytes: archiveBytes, sha256: `sha256:${archiveSha256}` },
    remoteRoot,
    remoteEvidence: installed.output.trim(),
    timings: { package: packageMs, upload: upload.durationMs, install: installed.durationMs, total: elapsed(started) },
    traffic: { artifactBytes: archiveBytes, uploadedBytes: archiveBytes, reusedBytes: 0 },
    installedAt: new Date().toISOString(),
  };
}

export async function verifyCommand(adapter, options) {
  const started = performance.now();
  const nodeKey = required(options.node ?? options.nodes?.[0], 'VERIFY_NODE_REQUIRED');
  const targetId = required(options.target, 'VERIFY_TARGET_REQUIRED');
  const node = adapter.nodes[nodeKey];
  const deployment = node?.deployments?.[targetId];
  invariant(Boolean(deployment), 'VERIFY_TARGET_UNKNOWN', `Unknown deployment ${nodeKey}/${targetId}`);
  const transport = node.transport ?? adapter.transport;
  if (transport.kind === 'ssh') return remoteControlCommand(adapter, options, 'verify');
  const results = [];
  let index = 0;
  for (const command of deployment.health ?? []) {
    results.push(
      await runCommand(command, {
        projectRoot: adapter.projectRoot,
        environment: {},
        changedFiles: [],
        logPath: join(statePaths(adapter).root, 'verification', `${nodeKey}-${targetId}-${index++}.log`),
        node: nodeKey,
        target: targetId,
      })
    );
  }
  return { schema: 'ai.delivery.verify.v1', project: adapter.project, node: nodeKey, target: targetId, results, timings: { verify: elapsed(started), total: elapsed(started) }, completedAt: new Date().toISOString() };
}

export async function rollbackCommand(adapter, options) {
  return remoteControlCommand(adapter, options, 'rollback');
}

export async function seedCommand(adapter, options) {
  const nodeKey = required(options.node ?? options.nodes?.[0], 'SEED_NODE_REQUIRED');
  const targetId = required(options.target, 'SEED_TARGET_REQUIRED');
  const sourceSha = required(options.sourceSha, 'SEED_SOURCE_SHA_REQUIRED');
  invariant(/^[a-f0-9]{40}$/.test(sourceSha), 'SEED_SOURCE_SHA_INVALID', 'Seed source must be a full lowercase Git SHA');
  const expected = `${adapter.project}:seed-layout:${sourceSha}`;
  invariant(options.approveSeed === expected, 'SEED_APPROVAL_REQUIRED', `Seed requires --approve-seed ${expected}`);
  const node = adapter.nodes[nodeKey];
  const deployment = node?.deployments?.[targetId];
  invariant(Boolean(deployment), 'SEED_TARGET_UNKNOWN', `Unknown deployment ${nodeKey}/${targetId}`);
  const transport = node.transport ?? adapter.transport;
  invariant(transport.kind === 'ssh', 'SEED_REQUIRES_REMOTE_POLICY', 'Seed is a one-time server migration and requires the remote policy');
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(Boolean(host), 'DEPLOY_SSH_HOST_MISSING', `SSH host missing for ${nodeKey}`);
  const remoteAgent = transport.agent ?? '/usr/local/lib/ai-delivery/agent.mjs';
  const result = await runCommand(
    {
      name: `seed:${nodeKey}:${targetId}`,
      argv: ['ssh', host, remoteAgent, 'seed', '--project', adapter.project, '--node', nodeKey, '--target', targetId, '--source-sha', sourceSha, '--approval', expected],
      timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
    },
    basicContext(adapter)
  );
  return { schema: 'ai.delivery.seed.v1', project: adapter.project, node: nodeKey, target: targetId, durationMs: result.durationMs, remote: parseCommandJson(result) };
}

export async function baselineCommand(adapter, options) {
  const nodeKey = required(options.node ?? options.nodes?.[0], 'BASELINE_NODE_REQUIRED');
  const targetId = required(options.target, 'BASELINE_TARGET_REQUIRED');
  const sourceSha = required(options.sourceSha, 'BASELINE_SOURCE_SHA_REQUIRED');
  invariant(/^[a-f0-9]{40}$/.test(sourceSha), 'BASELINE_SOURCE_SHA_INVALID', 'Baseline source must be a full lowercase Git SHA');
  const expected = `${adapter.project}:baseline:${sourceSha}`;
  invariant(options.approveBaseline === expected, 'BASELINE_APPROVAL_REQUIRED', `Baseline import requires --approve-baseline ${expected}`);
  const node = adapter.nodes[nodeKey];
  const deployment = node?.deployments?.[targetId];
  invariant(Boolean(deployment), 'BASELINE_TARGET_UNKNOWN', `Unknown deployment ${nodeKey}/${targetId}`);
  const transport = node.transport ?? adapter.transport;
  invariant(transport.kind === 'ssh', 'BASELINE_REQUIRES_REMOTE_POLICY', 'Baseline import requires the remote policy');
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(Boolean(host), 'DEPLOY_SSH_HOST_MISSING', `SSH host missing for ${nodeKey}`);
  const remoteAgent = transport.agent ?? '/usr/local/lib/ai-delivery/agent.mjs';
  const result = await runCommand(
    {
      name: `baseline:${nodeKey}:${targetId}`,
      argv: ['ssh', host, remoteAgent, 'baseline', '--project', adapter.project, '--node', nodeKey, '--target', targetId, '--source-sha', sourceSha, '--approval', expected],
      timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
    },
    basicContext(adapter)
  );
  return { schema: 'ai.delivery.baseline.v1', project: adapter.project, node: nodeKey, target: targetId, durationMs: result.durationMs, remote: parseCommandJson(result) };
}

export async function statusCommand(adapter, options) {
  if (!options.node || !options.target) {
    const paths = statePaths(adapter);
    return { schema: 'ai.delivery.status.v1', project: adapter.project, localState: paths.root, nodes: Object.keys(adapter.nodes).sort(), targets: Object.keys(adapter.targets).sort() };
  }
  return remoteControlCommand(adapter, options, 'status');
}

async function executeDeployment(adapter, item, environment, options) {
  const transport = item.node.transport ?? adapter.transport;
  invariant(transport?.kind === 'local' || transport?.kind === 'ssh', 'DEPLOY_TRANSPORT_INVALID', `Unsupported transport for ${item.nodeKey}`);
  if (options.dryRun) return { node: item.nodeKey, target: item.artifact.target, environment, dryRun: true, pointerRoot: item.deployment.pointerRoot, service: item.deployment.service };
  if (transport.kind === 'local') return localDeploy(adapter, item, environment);
  const remoteAgent = transport.agent ?? '/usr/local/lib/ai-delivery/agent.mjs';
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(Boolean(host), 'DEPLOY_SSH_HOST_MISSING', `SSH host missing for ${item.nodeKey}`);
  const incomingName = `${adapter.project}--${item.nodeKey}--${item.artifact.target}--${item.artifact.archive.sha256.slice(7)}`;
  const incoming = `${transport.incomingRoot ?? '/opt/ai-delivery/incoming'}/${incomingName}.tar.gz`;
  const incomingManifest = `${transport.incomingRoot ?? '/opt/ai-delivery/incoming'}/${incomingName}.artifact.json`;
  const identityArgs = [
    '--project',
    adapter.project,
    '--node',
    item.nodeKey,
    '--target',
    item.artifact.target,
    '--source-sha',
    item.artifact.sourceSha,
    '--sha256',
    item.artifact.archive.sha256.slice(7),
    '--tree-digest',
    item.artifact.treeDigest,
    '--manifest-digest',
    item.artifact.manifestDigest,
  ];
  const manifestBytes = (await lstat(item.artifact.manifestPath)).size;
  const artifactBytes = item.artifact.archive.bytes + manifestBytes;
  const direct = options.direct === true;
  const dependencyLayer = await ensureRemoteDependencyLayer(adapter, item, transport, host, remoteAgent);
  const lookup = await runCommand({ name: `artifact-lookup:${item.nodeKey}:${item.artifact.target}`, argv: ['ssh', host, remoteAgent, 'lookup', ...identityArgs], timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
  const lookupRemote = parseCommandJson(lookup);
  const lookupResult = lookupRemote?.result ?? {};
  let uploadDurationMs = 0;
  let uploadedBytes = 0;
  let staged;
  if (lookupResult.exists) {
    const action = direct ? 'reuse-direct' : 'reuse';
    staged = await runCommand({ name: `${action}:${item.nodeKey}:${item.artifact.target}`, argv: ['ssh', host, remoteAgent, action, ...identityArgs], timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
  } else {
    const uploadArchive = await runCommand(
      { name: `upload-archive:${item.nodeKey}:${item.artifact.target}`, argv: ['scp', item.artifact.archive.path, `${host}:${incoming}`], timeoutMs: transport.uploadTimeoutMs ?? 10 * 60_000 },
      basicContext(adapter)
    );
    const uploadManifest = await runCommand(
      { name: `upload-manifest:${item.nodeKey}:${item.artifact.target}`, argv: ['scp', item.artifact.manifestPath, `${host}:${incomingManifest}`], timeoutMs: transport.uploadTimeoutMs ?? 10 * 60_000 },
      basicContext(adapter)
    );
    uploadDurationMs = uploadArchive.durationMs + uploadManifest.durationMs;
    uploadedBytes = artifactBytes;
    const action = direct ? 'stage-direct' : 'stage';
    const stageArgv = [
      'ssh',
      host,
      remoteAgent,
      action,
      '--project',
      adapter.project,
      '--node',
      item.nodeKey,
      '--target',
      item.artifact.target,
      '--archive',
      incoming,
      '--manifest',
      incomingManifest,
      '--sha256',
      item.artifact.archive.sha256.slice(7),
      '--tree-digest',
      item.artifact.treeDigest,
    ];
    staged = await runCommand({ name: `${action}:${item.nodeKey}:${item.artifact.target}`, argv: stageArgv, timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
  }
  const stagedRemote = parseCommandJson(staged);
  let result = staged;
  let activated = null;
  let preflight = null;
  let externalBefore = null;
  let externalAfter = null;
  let targetExternal = null;
  if (environment === 'production') {
    if (!direct) {
      const preflightCommand = await runCommand(
        {
          name: `preflight:${item.nodeKey}:${item.artifact.target}`,
          argv: ['ssh', host, remoteAgent, 'preflight', '--project', adapter.project, '--node', item.nodeKey, '--target', item.artifact.target],
          timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
        },
        basicContext(adapter)
      );
      preflight = parseCommandJson(preflightCommand);
    }
    if (!direct && options.externalBaseline === true) externalBefore = await externalDomainSnapshot(adapter);
    const activateArgv = direct
      ? ['ssh', host, remoteAgent, 'activate-direct', '--project', adapter.project, '--node', item.nodeKey, '--target', item.artifact.target, '--source-sha', item.artifact.sourceSha]
      : [
          'ssh',
          host,
          remoteAgent,
          'activate',
          '--project',
          adapter.project,
          '--node',
          item.nodeKey,
          '--target',
          item.artifact.target,
          '--approval',
          `${adapter.project}:${item.artifact.sourceSha}`,
          '--expected-current',
          preflight.result.rollbackPoint.pointers.current ?? 'none',
        ];
    if (!direct && preflight.result.caddySemantic?.digest) activateArgv.push('--expected-caddy-semantic', preflight.result.caddySemantic.digest);
    try {
      activated = await runCommand({ name: `activate:${item.nodeKey}:${item.artifact.target}`, argv: activateArgv, timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000 }, basicContext(adapter));
    } catch (error) {
      if (adapter.targets[item.artifact.target]?.kind !== 'migration') throw error;
      const remoteFailure = parseRemoteFailure(error.details?.outputTail);
      if (!remoteFailure?.error) throw error;
      throw new DeliveryError(remoteFailure.error.code ?? 'DATABASE_MIGRATION_FAILED', remoteFailure.error.message ?? 'Database migration failed', {
        ...(remoteFailure.error.details ?? {}),
        transport: { code: error.code, details: error.details ?? {} },
      });
    }
    result = activated;
    if (!direct && options.externalBaseline === true) {
      [externalAfter, targetExternal] = await Promise.all([externalDomainSnapshot(adapter), externalTargetSnapshot(item.deployment)]);
      const domainDifferences = compareDomainSnapshots(externalBefore, externalAfter);
      if (domainDifferences.length > 0 || targetExternal?.passed === false) {
        const rolledBack = await runCommand(
          {
            name: `external-acceptance-rollback:${item.nodeKey}:${item.artifact.target}`,
            argv: ['ssh', host, remoteAgent, 'rollback', '--project', adapter.project, '--node', item.nodeKey, '--target', item.artifact.target],
            timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
          },
          basicContext(adapter)
        );
        const [afterRollback, targetAfterRollback] = await Promise.all([externalDomainSnapshot(adapter), externalTargetSnapshot(item.deployment)]);
        const rollbackDifferences = compareDomainSnapshots(externalBefore, afterRollback);
        const targetFailed = targetExternal?.passed === false;
        throw new DeliveryError(
          targetFailed ? 'TARGET_EXTERNAL_ACCEPTANCE_FAILED' : 'EXTERNAL_ACCEPTANCE_CHANGED',
          targetFailed ? 'Target public acceptance failed; target was rolled back' : 'External domain baseline changed; target was rolled back',
          { domainDifferences, rollbackDifferences, before: externalBefore, after: externalAfter, afterRollback, target: targetExternal, targetAfterRollback, rollback: parseCommandJson(rolledBack), activation: parseCommandJson(activated) }
        );
      }
    }
  }
  const activatedRemote = activated ? parseCommandJson(activated) : null;
  const activationTimings = activatedRemote?.result?.timings ?? {};
  return {
    node: item.nodeKey,
    target: item.artifact.target,
    environment,
    durationMs: dependencyLayer.durationMs + lookup.durationMs + uploadDurationMs + staged.durationMs + (activated?.durationMs ?? 0),
    cacheStatus: lookupResult.status ?? 'miss',
    artifactBytes,
    uploadedBytes: uploadedBytes + dependencyLayer.uploadedBytes,
    reusedBytes: artifactBytes - uploadedBytes + dependencyLayer.reusedBytes,
    uploadRateBytesPerSecond: uploadDurationMs > 0 ? Math.round(uploadedBytes / (uploadDurationMs / 1000)) : 0,
    timings: {
      artifactLookup: lookup.durationMs,
      dependencyLayer: dependencyLayer.durationMs,
      upload: uploadDurationMs,
      candidate: staged.durationMs,
      cutover: activationTimings.cutover ?? 0,
      restart: activationTimings.restart ?? 0,
      health: activationTimings.health ?? 0,
      isolation: activationTimings.isolation ?? 0,
      remoteTotal: activated?.durationMs ?? 0,
    },
    receipt: activatedRemote?.result?.receipt
      ? {
          ...activatedRemote.result.receipt,
          externalAcceptance: direct
            ? { status: 'skipped-direct' }
            : options.externalBaseline === true
              ? { status: 'passed', count: externalAfter.length, before: externalBefore, after: externalAfter, differences: [], target: targetExternal }
              : { status: 'not-requested' },
        }
      : null,
    remote: { lookup: lookupRemote, stage: stagedRemote, preflight, activate: activatedRemote, final: parseCommandJson(result) },
    pointerRoot: item.deployment.pointerRoot,
    service: item.deployment.service,
  };
}

async function ensureRemoteDependencyLayer(adapter, item, transport, host, remoteAgent) {
  const layer = item.artifact.dependencyLayer;
  if (!layer) return { durationMs: 0, uploadedBytes: 0, reusedBytes: 0 };
  const started = performance.now();
  const identityArgs = ['--digest', layer.digest, '--runtime', layer.runtime, '--production-root', layer.productionRoot];
  const lookup = await runCommand(
    {
      name: `layer-lookup:${item.nodeKey}:${item.artifact.target}`,
      argv: ['ssh', host, remoteAgent, 'layer-lookup', '--project', adapter.project, '--node', item.nodeKey, '--target', item.artifact.target, ...identityArgs],
      timeoutMs: transport.deployTimeoutMs ?? 10 * 60_000,
    },
    basicContext(adapter)
  );
  if (parseCommandJson(lookup)?.result?.exists) {
    return { durationMs: elapsed(started), uploadedBytes: 0, reusedBytes: parseCommandJson(lookup).result.bytes ?? 0 };
  }

  const localRoot = join(statePaths(adapter).root, 'dependency-layers');
  const prepared = await layerCommand(adapter, {
    target: item.artifact.target,
    destination: localRoot,
    sourceNodeModules: join(adapter.projectRoot, 'node_modules'),
  });
  invariant(prepared.digest === layer.digest, 'DEPENDENCY_LAYER_LOCAL_MISMATCH', 'Prepared dependency layer differs from artifact declaration');
  const archive = join(localRoot, `${layer.digest.slice(7)}.tar.gz`);
  await runCommand(
    {
      name: `layer-package:${item.nodeKey}:${item.artifact.target}`,
      argv: ['tar', '-czf', archive, '-C', prepared.destination, '.'],
      timeoutMs: 20 * 60_000,
    },
    basicContext(adapter)
  );
  const archiveStats = await lstat(archive);
  const archiveHash = await hashLocalFile(archive);
  const incoming = `${transport.incomingRoot ?? '/opt/ai-delivery/incoming'}/${adapter.project}--layer--${layer.digest.slice(7)}.tar.gz`;
  await runCommand(
    {
      name: `layer-upload:${item.nodeKey}:${item.artifact.target}`,
      argv: ['scp', archive, `${host}:${incoming}`],
      timeoutMs: transport.uploadTimeoutMs ?? 10 * 60_000,
    },
    basicContext(adapter)
  );
  await runCommand(
    {
      name: `layer-stage:${item.nodeKey}:${item.artifact.target}`,
      argv: ['ssh', host, remoteAgent, 'stage-layer', '--project', adapter.project, '--node', item.nodeKey, '--target', item.artifact.target, '--archive', incoming, '--sha256', archiveHash, ...identityArgs],
      timeoutMs: transport.deployTimeoutMs ?? 20 * 60_000,
    },
    basicContext(adapter)
  );
  return { durationMs: elapsed(started), uploadedBytes: archiveStats.size, reusedBytes: 0 };
}

async function externalDomainSnapshot(adapter) {
  const domains = adapter.productionAcceptance?.domains ?? [];
  invariant(domains.length === 8 && new Set(domains).size === 8, 'PRODUCTION_DOMAIN_BASELINE_INVALID', 'Production acceptance requires exactly 8 unique retained domains');
  const observations = await Promise.all(
    domains.map(async (host) => {
      try {
        const response = await fetch(`https://${host}/`, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(adapter.productionAcceptance?.timeoutMs ?? 12_000) });
        return { host, status: response.status, statusText: response.statusText || '' };
      } catch (error) {
        return { host, status: null, statusText: 'NO_HTTP_STATUS', error: error?.cause?.code ?? error?.name ?? 'FETCH_FAILED' };
      }
    })
  );
  return observations.sort((left, right) => left.host.localeCompare(right.host));
}

export async function externalTargetSnapshot(deployment) {
  const acceptance = deployment.publicAcceptance;
  if (!acceptance) return null;
  const allowedStatuses = acceptance.allowedStatuses ?? [200];
  try {
    const response = await fetch(acceptance.url, {
      method: acceptance.method ?? 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(acceptance.timeoutMs ?? 12_000),
    });
    await response.body?.cancel();
    return {
      url: acceptance.url,
      status: response.status,
      statusText: response.statusText || '',
      allowedStatuses,
      passed: allowedStatuses.includes(response.status),
    };
  } catch (error) {
    return {
      url: acceptance.url,
      status: null,
      statusText: 'NO_HTTP_STATUS',
      allowedStatuses,
      passed: false,
      error: error?.cause?.code ?? error?.name ?? 'FETCH_FAILED',
    };
  }
}

function compareDomainSnapshots(before, after) {
  const prior = new Map(before.map((item) => [item.host, `${item.status ?? ''}:${item.statusText}`]));
  return after.filter((item) => prior.get(item.host) !== `${item.status ?? ''}:${item.statusText}`).map((item) => ({ host: item.host, before: prior.get(item.host), after: `${item.status ?? ''}:${item.statusText}` }));
}

function aggregateDeployTimings(results) {
  const totals = { artifactLookup: 0, upload: 0, candidate: 0, cutover: 0, restart: 0, health: 0, isolation: 0 };
  for (const result of results) {
    for (const key of Object.keys(totals)) totals[key] += result.timings?.[key] ?? 0;
  }
  return totals;
}

function aggregateDeployTraffic(results) {
  const totals = { artifactBytes: 0, uploadedBytes: 0, reusedBytes: 0, uploadRateBytesPerSecond: 0 };
  for (const result of results) {
    for (const key of ['artifactBytes', 'uploadedBytes', 'reusedBytes']) totals[key] += result[key] ?? 0;
  }
  const uploadMs = results.reduce((total, result) => total + (result.timings?.upload ?? 0), 0);
  totals.uploadRateBytesPerSecond = uploadMs > 0 ? Math.round(totals.uploadedBytes / (uploadMs / 1000)) : 0;
  return totals;
}

async function localDeploy(adapter, item, environment) {
  const started = performance.now();
  const root = resolve(adapter.projectRoot, adapter.transport.localRoot ?? '.ai-delivery/local-remote');
  const targetRoot = join(root, item.nodeKey, item.artifact.target);
  const releases = join(targetRoot, 'releases');
  const release = join(releases, item.artifact.treeDigest.slice(7));
  await mkdir(release, { recursive: true });
  await cp(item.artifact.archive.path, join(release, basename(item.artifact.archive.path)), { force: true });
  if (environment === 'production') await writeFile(join(targetRoot, 'current.txt'), `${release}\n`);
  else await writeFile(join(targetRoot, 'candidate.txt'), `${release}\n`);
  const total = elapsed(started);
  return {
    node: item.nodeKey,
    target: item.artifact.target,
    environment,
    release,
    service: item.deployment.service,
    durationMs: total,
    timings: { upload: 0, candidate: environment === 'candidate' ? total : 0, cutover: environment === 'production' ? total : 0, restart: 0, health: 0, isolation: 0 },
  };
}

async function remoteControlCommand(adapter, options, action) {
  const nodeKey = required(options.node ?? options.nodes?.[0], `${action.toUpperCase()}_NODE_REQUIRED`);
  const targetId = required(options.target, `${action.toUpperCase()}_TARGET_REQUIRED`);
  const node = adapter.nodes[nodeKey];
  const deployment = node?.deployments?.[targetId];
  invariant(Boolean(deployment), `${action.toUpperCase()}_TARGET_UNKNOWN`, `Unknown deployment ${nodeKey}/${targetId}`);
  const transport = node.transport ?? adapter.transport;
  if (transport.kind === 'local') {
    return { schema: `ai.delivery.${action}.v1`, project: adapter.project, node: nodeKey, target: targetId, pointerRoot: deployment.pointerRoot, transport: 'local' };
  }
  const host = process.env[transport.hostEnv ?? 'AI_DELIVERY_SSH_HOST'] ?? transport.host;
  invariant(Boolean(host), 'DEPLOY_SSH_HOST_MISSING', `SSH host missing for ${nodeKey}`);
  const remoteAgent = transport.agent ?? '/usr/local/lib/ai-delivery/agent.mjs';
  const result = await runCommand(
    { name: `${action}:${nodeKey}:${targetId}`, argv: ['ssh', host, remoteAgent, action, '--project', adapter.project, '--node', nodeKey, '--target', targetId, '--pointer-root', deployment.pointerRoot, '--service', deployment.service] },
    basicContext(adapter)
  );
  return { schema: `ai.delivery.${action}.v1`, project: adapter.project, node: nodeKey, target: targetId, durationMs: result.durationMs, remote: parseCommandJson(result) };
}

function commandContext(adapter, plan, runDirectory, target, logName) {
  const outputDirectory = join(runDirectory, 'command-output', target);
  return {
    projectRoot: adapter.projectRoot,
    environment: { AI_DELIVERY_OUTPUT_DIR: outputDirectory, AI_DELIVERY_TARGET: target, AI_DELIVERY_SOURCE_SHA: plan.to.sha },
    changedFiles: plan.changes.map((change) => change.path),
    logPath: join(runDirectory, 'logs', `${logName.replaceAll(/[^A-Za-z0-9_.-]/g, '_')}.log`),
    outputDirectory,
    target,
    sourceSha: plan.to.sha,
  };
}

function basicContext(adapter) {
  return { projectRoot: adapter.projectRoot, environment: {}, changedFiles: [] };
}

function requiredPath(value, code) {
  return resolve(required(value, code));
}

function required(value, code) {
  if (!value) throw new DeliveryError(code, code.replaceAll('_', ' ').toLowerCase());
  return value;
}

async function hashLocalFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function elapsed(started) {
  return Math.max(0, Math.round(performance.now() - started));
}

function parseCommandJson(command) {
  try {
    return JSON.parse(command.output);
  } catch {
    throw new DeliveryError('REMOTE_AGENT_OUTPUT_INVALID', 'Remote delivery agent did not return JSON', { outputTail: command.outputTail });
  }
}

function parseRemoteFailure(output) {
  for (const line of String(output ?? '')
    .trim()
    .split('\n')
    .reverse()) {
    try {
      return JSON.parse(line);
    } catch {}
  }
  return null;
}
