import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { copyLatestLocalRegistrationOtp, LOCAL_REGISTRATION_OTP_COPIED, type LocalRegistrationOtpDependencies, type LocalRegistrationOtpInput } from './LocalRegistrationOtp';

const MOBILE = '13800138000';
const IDENTITY_KEY = 'identity-key-with-at-least-thirty-two-bytes';
const INPUT: LocalRegistrationOtpInput = {
  appEnv: 'development',
  mobile: MOBILE,
  platform: 'darwin',
  secretStoreEndpoint: 'https://127.0.0.1:8443',
  secretStoreBearerToken: 's'.repeat(43),
  kmsEndpoint: 'https://127.0.0.1:8444',
  kmsBearerToken: 'k'.repeat(43),
  adminDatabaseConnectionRef: 'shop/local/database/admin',
  identityKeyRef: 'shop/local/identity/index',
};

test('copies only the latest active registration challenge after Secret Store and KMS resolution', async () => {
  const events: unknown[] = [];
  const dependencies = fixture(events);
  await copyLatestLocalRegistrationOtp(INPUT, dependencies);

  const expectedHash = createHmac('sha256', IDENTITY_KEY).update(MOBILE).digest('hex');
  assert.deepEqual(events, [
    ['secret', INPUT.secretStoreEndpoint, INPUT.secretStoreBearerToken, INPUT.adminDatabaseConnectionRef],
    ['secret', INPUT.secretStoreEndpoint, INPUT.secretStoreBearerToken, INPUT.identityKeyRef],
    ['database', 'postgres://local:private@127.0.0.1:5432/shop'],
    ['query', expectedHash],
    ['end'],
    ['decrypt', INPUT.kmsEndpoint, 'identity/challenge', 'ciphertext-local', { challenge: 'challenge:latest', purpose: 'registration' }],
    ['copy', '654321'],
  ]);
});

test('fails closed before reading secrets outside the local development runtime', async () => {
  for (const input of [
    { ...INPUT, appEnv: 'production' },
    { ...INPUT, secretStoreEndpoint: 'https://secrets.example.com' },
    { ...INPUT, kmsEndpoint: 'https://kms.example.com' },
    { ...INPUT, platform: 'linux' as NodeJS.Platform },
  ]) {
    const events: unknown[] = [];
    await assert.rejects(copyLatestLocalRegistrationOtp(input, fixture(events)), /LOCAL_OTP_/);
    assert.deepEqual(events, []);
  }
});

test('rejects a remote database credential before querying or decrypting', async () => {
  const events: unknown[] = [];
  const dependencies = fixture(events, { connectionString: 'postgres://user:secret@db.example.com/shop' });
  await assert.rejects(copyLatestLocalRegistrationOtp(INPUT, dependencies), /LOCAL_OTP_DATABASE_INVALID/);
  assert.equal(events.some(event => Array.isArray(event) && ['database', 'query', 'decrypt', 'copy'].includes(String(event[0]))), false);
});

test('does not decrypt or copy when no active unconsumed challenge exists', async () => {
  const events: unknown[] = [];
  const dependencies = fixture(events, { challenge: undefined });
  await assert.rejects(copyLatestLocalRegistrationOtp(INPUT, dependencies), /LOCAL_REGISTRATION_OTP_NOT_FOUND/);
  assert.equal(events.some(event => Array.isArray(event) && ['decrypt', 'copy'].includes(String(event[0]))), false);
});

test('rejects malformed decrypted values and exposes only a non-sensitive success marker', async () => {
  const events: unknown[] = [];
  await assert.rejects(copyLatestLocalRegistrationOtp(INPUT, fixture(events, { decrypted: 'not-an-otp' })), /LOCAL_REGISTRATION_OTP_INVALID/);
  assert.equal(events.some(event => Array.isArray(event) && event[0] === 'copy'), false);
  assert.equal(LOCAL_REGISTRATION_OTP_COPIED.includes(MOBILE), false);
  assert.equal(LOCAL_REGISTRATION_OTP_COPIED.includes('654321'), false);
  assert.equal(LOCAL_REGISTRATION_OTP_COPIED, 'LOCAL_REGISTRATION_OTP_COPIED\n');
});

function fixture(
  events: unknown[],
  options: { readonly connectionString?: string; readonly challenge?: { readonly id: string; readonly code_ciphertext: string } | undefined; readonly decrypted?: string } = {}
): LocalRegistrationOtpDependencies {
  const challenge = Object.hasOwn(options, 'challenge') ? options.challenge : { id: 'challenge:latest', code_ciphertext: 'ciphertext-local' };
  return {
    readSecret: async (endpoint, bearerToken, reference) => {
      events.push(['secret', endpoint, bearerToken, reference]);
      return reference === INPUT.identityKeyRef ? IDENTITY_KEY : (options.connectionString ?? 'postgres://local:private@127.0.0.1:5432/shop');
    },
    openDatabase: async connectionString => {
      events.push(['database', connectionString]);
      return {
        query: async (text, values) => {
          assert.match(text, /purpose='registration'/);
          assert.match(text, /consumed_at is null/);
          assert.match(text, /expires_at>clock_timestamp\(\)/);
          assert.match(text, /order by challenge\.created_at desc/);
          events.push(['query', values[0]]);
          return { rows: challenge ? [challenge] : [] };
        },
        end: async () => { events.push(['end']); },
      };
    },
    decrypt: async (endpoint, keyRef, ciphertext, context) => {
      events.push(['decrypt', endpoint, keyRef, ciphertext, context]);
      return options.decrypted ?? '654321';
    },
    copy: async value => { events.push(['copy', value]); },
  };
}
