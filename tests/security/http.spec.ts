import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTRACT_VERSION, OperationCatalog } from '@shop/contract';
import { RouteRegistry } from '../../services/commerce/src/composition/RouteRegistry';
import { HttpApp } from '../../services/commerce/src/platform/http/HttpApp';
import { CsrfProtector } from '../../services/commerce/src/platform/security/CsrfProtector';

const csrfProtector = new CsrfProtector('security-test-csrf-key-material-32-bytes', {
  console: 'https://console.example',
  storefront: 'https://store.example',
});

function application(): HttpApp {
  const registry = new RouteRegistry();
  for (const operation of OperationCatalog.all()) registry.register({ operation: operation.id, handler: async () => ({ status: 200, body: { accepted: true } }) });
  registry.freeze();
  return new HttpApp(registry, ['https://store.example'], csrfProtector);
}

test('browser writes require an allowlisted origin and matching CSRF double submit token', async () => {
  const app = application();
  const denied = await app.handle(
    new Request('https://api.example/api/v1/carts/current/items/listing', { method: 'PUT', headers: { origin: 'https://evil.example', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION }, body: '{}' })
  );
  assert.equal(denied.status, 403);
  const rejectedProof = await app.handle(
    new Request('https://api.example/api/v1/carts/current/items/listing', {
      method: 'PUT',
      headers: { origin: 'https://store.example', cookie: '__Host-storefront-session=session; __Host-storefront-csrf=proof', 'x-client-target': 'storefront', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
      body: '{}',
    })
  );
  assert.equal(rejectedProof.status, 403);
  const proof = csrfProtector.issue('session', 'storefront', 60);
  const accepted = await app.handle(
    new Request('https://api.example/api/v1/carts/current/items/listing', {
      method: 'PUT',
      headers: {
        origin: 'https://store.example',
        cookie: `__Host-storefront-session=session; __Host-storefront-csrf=${proof}`,
        'x-client-target': 'storefront',
        'x-csrf-token': proof,
        'content-type': 'application/json',
        'x-contract-version': CONTRACT_VERSION,
      },
      body: '{}',
    })
  );
  assert.equal(accepted.status, 200);
});

test('allowlisted login uses bootstrap CSRF while one-time ticket exchange remains origin bound', async () => {
  const app = application();
  const login = await app.handle(
    new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST',
      headers: {
        origin: 'https://store.example',
        cookie: '__Host-auth-csrf=bootstrap',
        'x-csrf-token': 'bootstrap',
        'x-client-target': 'storefront',
        'content-type': 'application/json',
        'x-contract-version': CONTRACT_VERSION,
      },
      body: '{}',
    })
  );
  assert.equal(login.status, 200);

  const loginWithoutOrigin = await app.handle(
    new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST',
      headers: { cookie: '__Host-auth-csrf=bootstrap', 'x-csrf-token': 'bootstrap', 'x-client-target': 'storefront', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
      body: '{}',
    })
  );
  assert.equal(loginWithoutOrigin.status, 403);

  const exchange = await app.handle(
    new Request('https://api.example/api/v1/identity/tickets/exchange', {
      method: 'POST',
      headers: { origin: 'https://store.example', cookie: '__Host-storefront-session=session', 'x-client-target': 'storefront', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
      body: JSON.stringify({ ticket: 'ticket', state: 'state', nonce: 'nonce', verifier: 'verifier', returnTarget: 'signed-target' }),
    })
  );
  assert.equal(exchange.status, 200);

  const deniedOrigin = await app.handle(
    new Request('https://api.example/api/v1/identity/tickets/exchange', {
      method: 'POST',
      headers: { origin: 'https://evil.example', cookie: '__Host-storefront-session=session', 'x-client-target': 'storefront', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
      body: '{}',
    })
  );
  assert.equal(deniedOrigin.status, 403);

  const missingOrigin = await app.handle(
    new Request('https://api.example/api/v1/identity/tickets/exchange', {
      method: 'POST',
      headers: { cookie: '__Host-storefront-session=session', 'x-client-target': 'storefront', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
      body: '{}',
    })
  );
  assert.equal(missingOrigin.status, 403);

  const normalWrite = await app.handle(
    new Request('https://api.example/api/v1/identity/challenges', {
      method: 'POST',
      headers: { origin: 'https://store.example', cookie: '__Host-storefront-session=session; __Host-storefront-csrf=proof', 'x-client-target': 'storefront', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
      body: '{}',
    })
  );
  assert.equal(normalWrite.status, 403);
});

test('responses always include hard security headers and request correlation', async () => {
  const response = await application().handle(new Request('https://api.example/health/live', { headers: { 'x-request-id': 'request-1' } }));
  assert.equal(response.headers.get('x-request-id'), 'request-1');
  assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'none'/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('strict-transport-security') ?? '', /includeSubDomains/);
});

test('invalid media and oversized bodies fail before a handler executes', async () => {
  const app = application();
  const media = await app.handle(
    new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST',
      headers: { origin: 'https://store.example', cookie: '__Host-auth-csrf=bootstrap', 'x-csrf-token': 'bootstrap', 'x-client-target': 'storefront', 'content-type': 'text/plain', 'x-contract-version': CONTRACT_VERSION },
      body: 'value',
    })
  );
  assert.equal(media.status, 415);
  const large = await app.handle(
    new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST',
      headers: {
        origin: 'https://store.example',
        cookie: '__Host-auth-csrf=bootstrap',
        'x-csrf-token': 'bootstrap',
        'x-client-target': 'storefront',
        'content-type': 'application/json',
        'content-length': String(2 * 1024 * 1024 + 1),
        'x-contract-version': CONTRACT_VERSION,
      },
      body: '{}',
    })
  );
  assert.equal(large.status, 413);
});
