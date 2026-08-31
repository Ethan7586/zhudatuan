import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { LocalKms } from './LocalKms';

test('encrypts and decrypts with bound context', () => {
  const kms = new LocalKms(randomBytes(32).toString('base64url'));
  const context = { tenantId: 'tenant-local' };
  const envelope = kms.encrypt('pii', 'identity/credential', 'secret-value', context);
  assert.match(envelope.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(kms.decrypt('pii', 'identity/credential', envelope.ciphertext, context), 'secret-value');
  assert.throws(() => kms.decrypt('pii', 'identity/credential', envelope.ciphertext, { tenantId: 'other' }), /KMS_CIPHERTEXT_INVALID/);
  assert.throws(() => kms.decrypt('evidence', 'identity/credential', envelope.ciphertext, context), /KMS_CIPHERTEXT_INVALID/);
});

test('does not emit deterministic ciphertext', () => {
  const kms = new LocalKms(randomBytes(32).toString('base64url'));
  const left = kms.encrypt('pii', 'identity/credential', 'same', {});
  const right = kms.encrypt('pii', 'identity/credential', 'same', {});
  assert.notEqual(left.ciphertext, right.ciphertext);
  assert.equal(left.fingerprint, right.fingerprint);
});
