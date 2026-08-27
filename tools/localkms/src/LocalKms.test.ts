import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { LocalKms } from './LocalKms';

test('encrypts and decrypts with bound context', () => {
  const kms = new LocalKms(randomBytes(32).toString('base64url'));
  const context = { tenantId: 'tenant-local' };
  const envelope = kms.encrypt('identity/credential', 'secret-value', context);
  assert.match(envelope.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(kms.decrypt('identity/credential', envelope.ciphertext, context), 'secret-value');
  assert.throws(() => kms.decrypt('identity/credential', envelope.ciphertext, { tenantId: 'other' }), /KMS_CIPHERTEXT_INVALID/);
});

test('does not emit deterministic ciphertext', () => {
  const kms = new LocalKms(randomBytes(32).toString('base64url'));
  const left = kms.encrypt('identity/credential', 'same', {});
  const right = kms.encrypt('identity/credential', 'same', {});
  assert.notEqual(left.ciphertext, right.ciphertext);
  assert.equal(left.fingerprint, right.fingerprint);
});
