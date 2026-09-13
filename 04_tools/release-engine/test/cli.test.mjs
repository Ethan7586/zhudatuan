import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { assertPreparedControlPlane, deployPreparedCommand, validatePreparedCommand } from '../src/engine.mjs';

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
