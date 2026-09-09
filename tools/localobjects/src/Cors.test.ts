import assert from 'node:assert/strict';
import test from 'node:test';
import type { LocalRequest } from '../../localinfra/src/Http';
import { withObjectCors } from './Cors';

const origin = 'http://127.0.0.1:4173';
const handler = withObjectCors(async () => ({ status: 204 }));

test('allows the exact local console origin to preflight a signed upload', async () => {
  const response = await handler(
    request('/v1/public-upload/upload-id', 'OPTIONS', {
      origin,
      'access-control-request-method': 'PUT',
      'access-control-request-headers': 'Content-Type, X-Content-Sha256, X-Retention-Until',
    })
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers?.['access-control-allow-origin'], origin);
  assert.equal(response.headers?.['access-control-allow-methods'], 'PUT');
  assert.equal(response.headers?.['access-control-max-age'], '600');
  assert.equal(response.headers?.vary, 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
});

test('adds an origin-specific response policy without allowing credentials', async () => {
  const response = await handler(request('/v1/public-upload/upload-id', 'PUT', { origin }));

  assert.equal(response.headers?.['access-control-allow-origin'], origin);
  assert.equal(response.headers?.['access-control-allow-credentials'], undefined);
  assert.equal(response.headers?.vary, 'Origin');
});

test('rejects unknown origins, methods and request headers', async () => {
  await assert.rejects(() => handler(request('/v1/public-upload/upload-id', 'PUT', { origin: 'https://attacker.example' })), /CORS_ORIGIN_FORBIDDEN/);
  await assert.rejects(() => handler(request('/v1/public-upload/upload-id', 'OPTIONS', { origin, 'access-control-request-method': 'DELETE' })), /CORS_METHOD_FORBIDDEN/);
  await assert.rejects(
    () =>
      handler(
        request('/v1/public-upload/upload-id', 'OPTIONS', {
          origin,
          'access-control-request-method': 'PUT',
          'access-control-request-headers': 'authorization',
        })
      ),
    /CORS_HEADER_FORBIDDEN/
  );
});

test('does not apply browser CORS behavior to private object routes', async () => {
  const response = await handler(request('/v1/objects', 'GET', { origin: 'https://attacker.example' }));
  assert.equal(response.status, 204);
  assert.equal(response.headers, undefined);
});

function request(pathname: string, method: string, headers: Readonly<Record<string, string>>): LocalRequest {
  return Object.freeze({ body: new Uint8Array(), headers, method, url: new URL(pathname, 'https://127.0.0.1:8445') });
}
