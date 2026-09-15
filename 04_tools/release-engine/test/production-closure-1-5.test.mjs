import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { DeliveryError } from '../src/errors.mjs';
import { inspectClosureComponentCommand } from '../src/production-orchestrator.mjs';

const sourceSha = 'a'.repeat(40);
const controlPlaneSha = 'b'.repeat(40);
const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const options = { sourceSha, controlSha: controlPlaneSha, target: 'database-migration', node: 'node-a' };

test('exact sealed, resumable and absent components choose no-op, Seal-only or Prepare without List', async () => {
  const prepared = { manifest: { artifact: { sha256: `sha256:${'c'.repeat(64)}` } } };
  const sealed = await inspectClosureComponentCommand({}, options, {
    resolvePrepared: async () => prepared,
    requireSeal: async () => ({ object: 'exact/final-seal.json' }),
  });
  assert.equal(sealed.action, 'NOOP_ALREADY_SEALED');

  const resumable = await inspectClosureComponentCommand({}, options, {
    resolvePrepared: async () => prepared,
    requireSeal: async () => { throw new DeliveryError('FINAL_SEAL_RECEIPT_MISSING', 'missing', {
      requestId: 'request-1', attemptId: '2', failureClass: 'FINAL_SEAL_MISSING_AFTER_VALIDATION',
      retryable: true, resumeAllowed: true, resumeFrom: 'RESUME_FROM_FINAL_SEAL_WRITE',
      nextSafeAction: 'write-final-seal-once-then-exact-readback', exactResource: 'exact/final-seal.json' }); },
  });
  assert.equal(resumable.action, 'RESUME_FINAL_SEAL_WRITE');
  assert.equal(resumable.requestId, 'request-1');

  const absent = await inspectClosureComponentCommand({}, options, {
    resolvePrepared: async () => { throw new DeliveryError('OSS_ARTIFACT_NOT_FOUND', 'missing'); },
  });
  assert.equal(absent.action, 'PREPARE');
});

test('real workflow uses v2 Closure authority, Resume inspection and exact Seal digest binding', async () => {
  const [automatic, oneTarget, deploySource, deployPrepared] = await Promise.all([
    readFile(join(root, '.github/workflows/auto-prepare-artifacts.yml'), 'utf8'),
    readFile(join(root, '.github/workflows/auto-prepare-one-target.yml'), 'utf8'),
    readFile(join(root, '.github/workflows/deploy-source-aliyun.yml'), 'utf8'),
    readFile(join(root, '.github/workflows/deploy-prepared-aliyun.yml'), 'utf8'),
  ]);
  assert.match(automatic, /finalizeProductionClosureManifest/);
  assert.match(automatic, /No failed automatic closure exists for the exact source SHA/);
  assert.match(oneTarget, /inspect-closure-component/);
  assert.match(oneTarget, /NOOP_ALREADY_SEALED/);
  assert.match(deploySource, /verifyProductionClosureManifest/);
  assert.match(deploySource, /seal_digest: \$\{\{ matrix\.final_seal_digest \}\}/);
  assert.match(deployPrepared, /--seal-digest/);
});
