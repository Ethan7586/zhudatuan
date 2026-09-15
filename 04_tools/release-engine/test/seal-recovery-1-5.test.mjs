import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { classifySealCheckpoint } from '../src/seal-recovery.mjs';
import { createOssClient, requireFinalSealReceipt } from '../src/oss.mjs';
import { DeliveryError } from '../src/errors.mjs';

const exactResource = 'fixture/app/source/seals/v1/node/digest/control/final-seal.json';
const decide = (value) => classifySealCheckpoint({ exactResource, ...value });

test('matching final Seal is idempotent success without rebuild or upload', () => {
  const result = decide({ finalSeal: {} });
  assert.equal(result.failureClass, 'FINAL_SEAL_ALREADY_VALID'); assert.equal(result.nextSafeAction, 'accept-idempotent-success');
});

test('complete uploaded and validated evidence resumes only at final Seal write', () => {
  const result = decide({ uploaded: {}, validated: {} });
  assert.deepEqual([result.retryable, result.resumeAllowed, result.resumeFrom], [true, true, 'RESUME_FROM_FINAL_SEAL_WRITE']);
});

test('FINAL_SEAL_RECEIPT_MISSING exposes exact resume fields without ListObjects', async () => {
  let lists = 0;
  const client = {
    async getObject(path, missingCode) {
      if (path.endsWith('/uploaded.json')) return Buffer.from(JSON.stringify({ updated_at: '2026-01-01T00:00:00Z' }));
      if (path.endsWith('/candidate-validation.json')) return Buffer.from(JSON.stringify({ updated_at: '2026-01-01T00:01:00Z' }));
      throw new DeliveryError(missingCode, 'missing');
    },
    async listPrefix() { lists += 1; return []; }, async putImmutable() {},
  };
  const adapter = { project: 'fixture' };
  await assert.rejects(requireFinalSealReceipt(adapter, { sourceSha: 'a'.repeat(40), target: 'app', node: 'node-a',
    artifactDigest: `sha256:${'c'.repeat(64)}`, controlPlaneSha: 'b'.repeat(40) }, { client }), (error) => {
    assert.equal(error.code, 'FINAL_SEAL_RECEIPT_MISSING');
    assert.equal(error.details.resumeFrom, 'RESUME_FROM_FINAL_SEAL_WRITE');
    assert.equal(error.details.exactResource.endsWith('/final-seal.json'), true);
    return true;
  });
  assert.equal(lists, 0);
});

test('unknown write outcome requires exact readback before retry', () => {
  const result = decide({ writeOutcomeUnknown: true });
  assert.equal(result.resumeFrom, 'EXACT_FINAL_SEAL_READBACK'); assert.match(result.nextSafeAction, /head-get/);
});

test('an uncertain immutable PUT performs exact readback before any second write', async () => {
  const body = Buffer.from('final-seal');
  let puts = 0; let heads = 0;
  const client = createOssClient({ accessKeyId: 'fixture-id', accessKeySecret: 'fixture-secret', bucket: 'fixture-bucket', endpoint: 'https://oss.example.test' }, {
    sleep: async () => {}, fetchImpl: async (_url, options) => {
      if (options.method === 'PUT') { puts += 1; const error = new Error('timeout after commit'); error.code = 'ETIMEDOUT'; throw error; }
      heads += 1;
      return new Response(null, { status: 200, headers: { date: new Date().toUTCString(), 'content-length': String(body.length),
        'x-oss-meta-sha256': createHash('sha256').update(body).digest('hex') } });
    },
  });
  const result = await client.putImmutable(exactResource, body, 'application/json', { verifyAfterUncertain: true });
  assert.equal(result.readbackRecovered, true); assert.equal(puts, 1); assert.equal(heads, 1);
});

test('expired short-lived credential has a finite refresh budget', () => {
  const result = decide({ credentialExpired: true, safeCheckpoint: 'VALIDATED', maxAttempts: 2 });
  assert.equal(result.audit.maxAttempts, 2); assert.equal(result.resumeAllowed, true);
});

test('permission denial reports role, action and exact resource without blind retry', () => {
  const result = decide({ permissionDenied: true, identity: 'github-oidc', roleKind: 'releaser', ossAction: 'oss:PutObject', safeCheckpoint: 'VALIDATED' });
  assert.equal(result.retryable, false); assert.equal(result.exactResource, exactResource);
  assert.deepEqual(result.audit, { identity: 'github-oidc', roleKind: 'releaser', ossAction: 'oss:PutObject' });
});

test('identity mismatch is a non-resumable safety block', () => {
  const result = decide({ identityMismatch: true });
  assert.deepEqual([result.failureClass, result.retryable, result.resumeAllowed], ['SEAL_IDENTITY_MISMATCH', false, false]);
});

test('incomplete prior evidence cannot skip directly to final Seal', () => {
  const result = decide({ uploaded: {} });
  assert.equal(result.failureClass, 'FINAL_SEAL_EVIDENCE_INCOMPLETE'); assert.equal(result.resumeAllowed, false);
});

test('component preparation is isolated while production cutover remains closed', async () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
  const workflow = await readFile(join(root, '.github/workflows/auto-prepare-artifacts.yml'), 'utf8');
  const gate = JSON.parse(await readFile(join(root, '04_tools/release-engine/policies/component-seal-gate.json'), 'utf8'));
  assert.match(workflow, /strategy:\n\s+fail-fast: false\n\s+matrix:/);
  assert.equal(gate.preparation.componentsIndependent, true);
  assert.equal(gate.productionCutover.gate, 'all-required-components-final-sealed');
  assert.equal(gate.productionCutover.atomicReleaseAllowed, false);
});
