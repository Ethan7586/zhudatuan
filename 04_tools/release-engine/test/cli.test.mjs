import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { assertLegacyDeploymentEvidence, assertPreparedControlPlane, assertPreparedSourceLineage, deployPreparedCommand, validatePreparedCommand } from '../src/engine.mjs';

const releaseEngineRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('external baseline is an explicit boolean CLI option', () => {
  const result = spawnSync(process.execPath, ['cli.mjs', 'deploy', '--external-baseline', '--help'], {
    cwd: releaseEngineRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /统一 AI 发布引擎/);
});

test('direct deployment is an explicit boolean CLI option', () => {
  const result = spawnSync(process.execPath, ['cli.mjs', 'deploy', '--direct', '--help'], {
    cwd: releaseEngineRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /统一 AI 发布引擎/);
});

test('artifact preparation is an explicit boolean CLI option with separate publish and deploy commands', () => {
  const result = spawnSync(process.execPath, ['cli.mjs', 'plan', '--prepare', '--help'], {
    cwd: releaseEngineRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /publish\|verify-reproducibility\|validate-prepared\|deploy-prepared/);
  assert.match(result.stdout, /--prepare/);
  assert.match(result.stdout, /verify-reproducibility/);
  assert.match(result.stdout, /--state-directory/);
});

test('prepared commands require exact control provenance and expected remote digests', async () => {
  const adapter = {
    project: 'fixture',
    projectRoot: process.cwd(),
    targets: { app: {} },
    nodes: { local: { deployments: { app: {} } } },
  };
  const base = { sourceSha: 'a'.repeat(40), target: 'app', nodes: ['local'] };
  await assert.rejects(
    () => validatePreparedCommand(adapter, base),
    (error) => error.code === 'PREPARED_DEPLOY_CONTROL_SHA_REQUIRED'
  );
  await assert.rejects(
    () => deployPreparedCommand(adapter, { ...base, controlSha: 'b'.repeat(40), githubRunId: '10', githubRunAttempt: '1' }),
    (error) => error.code === 'PREPARED_DEPLOY_REMOTE_AGENT_SHA256_REQUIRED'
  );
});

test('prepared control-plane evidence must match the expected Agent and policy exactly', () => {
  const expected = {
    sourceSha: 'b'.repeat(40),
    githubRunId: '10',
    githubRunAttempt: '1',
    remoteAgentSha256: `sha256:${'c'.repeat(64)}`,
    remotePolicySha256: `sha256:${'d'.repeat(64)}`,
  };
  const evidence = {
    sourceSha: expected.sourceSha,
    github: { runId: expected.githubRunId, runAttempt: expected.githubRunAttempt },
    remoteAgentSha256: expected.remoteAgentSha256,
    remotePolicySha256: expected.remotePolicySha256,
  };

  assert.equal(assertPreparedControlPlane(evidence, expected), evidence);
  assert.throws(
    () => assertPreparedControlPlane({ ...evidence, remoteAgentSha256: `sha256:${'e'.repeat(64)}` }, expected),
    (error) => error.code === 'PREPARED_DEPLOY_REMOTE_PROVENANCE_MISMATCH'
  );
  assert.throws(
    () => assertPreparedControlPlane({ ...evidence, remotePolicySha256: `sha256:${'f'.repeat(64)}` }, expected),
    (error) => error.code === 'PREPARED_DEPLOY_REMOTE_PROVENANCE_MISMATCH'
  );
});

test('prepared candidate source must contain the exact current production source', () => {
  const currentSourceSha = 'a'.repeat(40);
  const candidateSourceSha = 'b'.repeat(40);
  assert.deepEqual(assertPreparedSourceLineage({ after: '/release/a', sourceSha: currentSourceSha }, candidateSourceSha, currentSourceSha), {
    status: 'verified',
    currentSourceSha,
    candidateSourceSha,
    mergeBaseSha: currentSourceSha,
  });
  assert.throws(
    () => assertPreparedSourceLineage({ after: '/release/a', sourceSha: currentSourceSha }, candidateSourceSha, 'c'.repeat(40)),
    (error) => error.code === 'PREPARED_SOURCE_DOES_NOT_CONTAIN_CURRENT'
  );
  assert.throws(
    () => assertPreparedSourceLineage({ after: '/legacy/current', sourceSha: null }, candidateSourceSha, null),
    (error) => error.code === 'PREPARED_CURRENT_SOURCE_UNAVAILABLE'
  );
  assert.equal(assertPreparedSourceLineage({ after: null, sourceSha: null }, candidateSourceSha, null).status, 'first-activation');
});

test('legacy baseline evidence requires one successful exact workflow receipt', () => {
  const sourceSha = '1'.repeat(40);
  const artifactSha256 = '2'.repeat(64);
  const legacyRunId = '34796885384';
  const legacyRunAttempt = '1';
  const target = 'support-api';
  const expectedCurrent = `/opt/targets/support-api/releases/${sourceSha.slice(0, 12)}-${artifactSha256.slice(0, 16)}`;
  const metadata = {
    id: Number(legacyRunId),
    head_sha: sourceSha,
    conclusion: 'success',
    event: 'workflow_dispatch',
    path: '.github/workflows/legacy-oss-recovery-aliyun.yml',
    run_attempt: 1,
  };
  const log = `SOURCE_SHA=${sourceSha}\nCURRENT_${target}=${expectedCurrent}\nzdt-next/commerce-api/${sourceSha}/${artifactSha256}.tar.gz\n`;
  const expected = { sourceSha, artifactSha256, legacyRunId, legacyRunAttempt, target, expectedCurrent };

  assert.equal(assertLegacyDeploymentEvidence(metadata, log, expected).current, expectedCurrent);
  assert.throws(
    () => assertLegacyDeploymentEvidence({ ...metadata, conclusion: 'failure' }, log, expected),
    (error) => error.code === 'CURRENT_BASELINE_LEGACY_RUN_UNTRUSTED'
  );
  assert.throws(
    () => assertLegacyDeploymentEvidence(metadata, log.replace(`CURRENT_${target}=`, 'CURRENT_other='), expected),
    (error) => error.code === 'CURRENT_BASELINE_LEGACY_TARGET_RECEIPT_MISSING'
  );
  assert.throws(
    () => assertLegacyDeploymentEvidence(metadata, log.replace(artifactSha256, '3'.repeat(64)), expected),
    (error) => error.code === 'CURRENT_BASELINE_LEGACY_ARTIFACT_RECEIPT_MISSING'
  );

  const databaseTarget = 'database-migration';
  const databaseCurrent = `/opt/ai-delivery/database-migrations/zdt-next/releases/${sourceSha.slice(0, 12)}-${artifactSha256.slice(0, 16)}`;
  const databaseLog = `SOURCE_SHA=${sourceSha}\nCURRENT_DATABASE_MIGRATIONS=${databaseCurrent}\nzdt-next/database-migrations/${sourceSha}/${artifactSha256}.tar.gz\n`;
  assert.equal(assertLegacyDeploymentEvidence(metadata, databaseLog, {
    ...expected,
    target: databaseTarget,
    expectedCurrent: databaseCurrent,
  }).current, databaseCurrent);
});
