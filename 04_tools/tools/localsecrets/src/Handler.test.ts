import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LocalHttpError, type LocalRequest } from '../../localinfra/src/Http';
import { secretStoreHandler } from './Handler';

const token = 's'.repeat(43);
const handler = secretStoreHandler({ get: reference => reference === 'secret/example' ? 'protected-value' : undefined }, token);

describe('local Secret Store workload authentication', () => {
  it('keeps health ready unauthenticated', async () => {
    const response = await handler(request('/health/ready'));
    assert.equal(response.status, 200);
  });

  it('rejects a missing or wrong bearer before method and path validation', async () => {
    await assertAuthenticationRequired(() => handler(request('/not-a-route', 'POST')));
    await assertAuthenticationRequired(() => handler(request('/v1/secrets/secret%2Fexample', 'POST', 'x'.repeat(43))));
  });

  it('returns a secret only for the correct bearer', async () => {
    const response = await handler(request('/v1/secrets/secret%2Fexample', 'GET', token));
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(new TextDecoder().decode(response.body)), { value: 'protected-value' });
  });

  it('rejects an authenticated workload before reading a ref outside its allowlist', async () => {
    let reads = 0;
    const scoped = secretStoreHandler({ get: () => { reads += 1; return 'must-not-be-read'; } }, {
      authenticate: () => 'identity-registration-api',
      require: (_workload, reference) => {
        if (reference !== 'secret/allowed') throw new LocalHttpError(403, 'WORKLOAD_AUTHORIZATION_DENIED');
      },
    });
    await assert.rejects(() => scoped(request('/v1/secrets/secret%2Fowner-password', 'GET', token)),
      (cause: unknown) => cause instanceof LocalHttpError && cause.status === 403);
    assert.equal(reads, 0);
  });
});

function request(path: string, method = 'GET', bearer?: string): LocalRequest {
  return Object.freeze({
    body: new Uint8Array(),
    headers: bearer === undefined ? {} : { authorization: `Bearer ${bearer}` },
    method,
    url: new URL(path, 'https://127.0.0.1'),
  });
}

async function assertAuthenticationRequired(operation: () => Promise<unknown>): Promise<void> {
  await assert.rejects(operation, (cause: unknown) => cause instanceof LocalHttpError
    && cause.status === 401 && cause.code === 'WORKLOAD_AUTHENTICATION_REQUIRED');
}
