import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LocalHttpError, type LocalRequest } from '../../localinfra/src/Http';
import { kmsHandler } from './Handler';
import { LocalKms } from './LocalKms';

const token = 'k'.repeat(43);
const handler = kmsHandler(new LocalKms(Buffer.alloc(32, 7).toString('base64url')), token);

describe('local KMS workload authentication', () => {
  it('keeps health ready unauthenticated', async () => {
    assert.equal((await handler(request('/health/ready', 'GET'))).status, 200);
  });

  it('rejects a missing or wrong bearer before method, path, and JSON validation', async () => {
    await assertAuthenticationRequired(() => handler(request('/not-a-route', 'GET')));
    await assertAuthenticationRequired(() => handler(request('/v1/envelopes', 'POST', 'x'.repeat(43), new Uint8Array([0xff]))));
  });

  it('encrypts and decrypts only for the correct bearer', async () => {
    const encrypted = await handler(jsonRequest('/v1/envelopes', token, {
      context: { principal: 'principal:one' }, keyRef: 'identity/mobile', plaintext: '13800138000',
    }));
    assert.equal(encrypted.status, 200);
    const envelope = JSON.parse(new TextDecoder().decode(encrypted.body)) as { ciphertext: string };
    const decrypted = await handler(jsonRequest('/v1/plaintexts', token, {
      context: { principal: 'principal:one' }, keyRef: 'identity/mobile', ciphertext: envelope.ciphertext,
    }));
    assert.deepEqual(JSON.parse(new TextDecoder().decode(decrypted.body)), { plaintext: '13800138000' });
  });
});

function jsonRequest(path: string, bearer: string, body: unknown): LocalRequest {
  return request(path, 'POST', bearer, new TextEncoder().encode(JSON.stringify(body)), { 'content-type': 'application/json' });
}

function request(path: string, method: string, bearer?: string, body = new Uint8Array(), extra: Readonly<Record<string, string>> = {}): LocalRequest {
  return Object.freeze({
    body,
    headers: { ...extra, ...(bearer === undefined ? {} : { authorization: `Bearer ${bearer}` }) },
    method,
    url: new URL(path, 'https://127.0.0.1'),
  });
}

async function assertAuthenticationRequired(operation: () => Promise<unknown>): Promise<void> {
  await assert.rejects(operation, (cause: unknown) => cause instanceof LocalHttpError
    && cause.status === 401 && cause.code === 'WORKLOAD_AUTHENTICATION_REQUIRED');
}
