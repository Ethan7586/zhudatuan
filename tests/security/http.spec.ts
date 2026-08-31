import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTRACT_VERSION, OperationCatalog } from '@shop/contract';
import { RouteRegistry } from '../../services/commerce/src/bootstrap/RouteRegistry';
import { HttpApp } from '../../services/commerce/src/foundation/interface/HttpApp';

function application(): HttpApp {
  const registry = new RouteRegistry();
  for (const operation of OperationCatalog.all()) registry.register({ operation: operation.id, handler: async () => ({ status: 200, body: { accepted: true } }) });
  registry.freeze();
  return new HttpApp(registry, ['https://store.example']);
}

test('browser writes require an allowlisted origin and matching CSRF double submit token', async () => {
  const app = application();
  const denied = await app.handle(new Request('https://api.example/api/v1/carts/current/items/listing', { method: 'PUT', headers: { origin: 'https://evil.example', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION }, body: '{}' }));
  assert.equal(denied.status, 403);
  const csrf = await app.handle(new Request('https://api.example/api/v1/carts/current/items/listing', { method: 'PUT', headers: { origin: 'https://store.example', cookie: 'shop_session=session; shop_csrf=proof', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION }, body: '{}' }));
  assert.equal(csrf.status, 403);
  const accepted = await app.handle(new Request('https://api.example/api/v1/carts/current/items/listing', { method: 'PUT', headers: { origin: 'https://store.example', cookie: 'shop_session=session; shop_csrf=proof', 'x-csrf-token': 'proof', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION }, body: '{}' }));
  assert.equal(accepted.status, 200);
});

<<<<<<< HEAD
<<<<<<< HEAD
test('allowlisted login and one-time ticket exchange use Origin instead of a readable cross-subdomain CSRF cookie', async () => {
  const app = application();
  const login = await app.handle(new Request('https://api.example/api/v1/identity/sessions', {
    method: 'POST',
    headers: { origin: 'https://store.example', cookie: 'shop_session=stale', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
    body: '{}',
  }));
  assert.equal(login.status, 200);

  const loginWithoutOrigin = await app.handle(new Request('https://api.example/api/v1/identity/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
    body: '{}',
  }));
  assert.equal(loginWithoutOrigin.status, 403);

=======
test('one-time auth ticket exchange is the only browser write that does not require a CSRF token', async () => {
  const app = application();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
test('allowlisted login and one-time ticket exchange use Origin instead of a readable cross-subdomain CSRF cookie', async () => {
  const app = application();
  const login = await app.handle(new Request('https://api.example/api/v1/identity/sessions', {
    method: 'POST',
    headers: { origin: 'https://store.example', cookie: 'shop_session=stale', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
    body: '{}',
  }));
  assert.equal(login.status, 200);

  const loginWithoutOrigin = await app.handle(new Request('https://api.example/api/v1/identity/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
    body: '{}',
  }));
  assert.equal(loginWithoutOrigin.status, 403);

>>>>>>> 018b2a71 (chore(release): capture current production source)
  const exchange = await app.handle(new Request('https://api.example/api/v1/identity/tickets/exchange', {
    method: 'POST',
    headers: { origin: 'https://store.example', cookie: 'shop_session=session', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
    body: JSON.stringify({ ticket: 'ticket', state: 'state', nonce: 'nonce', verifier: 'verifier' }),
  }));
  assert.equal(exchange.status, 200);

  const deniedOrigin = await app.handle(new Request('https://api.example/api/v1/identity/tickets/exchange', {
    method: 'POST',
    headers: { origin: 'https://evil.example', cookie: 'shop_session=session', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
    body: '{}',
  }));
  assert.equal(deniedOrigin.status, 403);

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const missingOrigin = await app.handle(new Request('https://api.example/api/v1/identity/tickets/exchange', {
    method: 'POST',
    headers: { cookie: 'shop_session=session', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
    body: '{}',
  }));
  assert.equal(missingOrigin.status, 403);

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const normalWrite = await app.handle(new Request('https://api.example/api/v1/identity/challenges', {
    method: 'POST',
    headers: { origin: 'https://store.example', cookie: 'shop_session=session', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
    body: '{}',
  }));
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
<<<<<<< HEAD
<<<<<<< HEAD
  const media = await app.handle(new Request('https://api.example/api/v1/identity/sessions', { method: 'POST', headers: { origin: 'https://store.example', 'content-type': 'text/plain', 'x-contract-version': CONTRACT_VERSION }, body: 'value' }));
  assert.equal(media.status, 415);
  const large = await app.handle(new Request('https://api.example/api/v1/identity/sessions', { method: 'POST', headers: { origin: 'https://store.example', 'content-type': 'application/json', 'content-length': String(2 * 1024 * 1024 + 1), 'x-contract-version': CONTRACT_VERSION }, body: '{}' }));
=======
  const media = await app.handle(new Request('https://api.example/api/v1/identity/sessions', { method: 'POST', headers: { 'content-type': 'text/plain', 'x-contract-version': CONTRACT_VERSION }, body: 'value' }));
  assert.equal(media.status, 415);
  const large = await app.handle(new Request('https://api.example/api/v1/identity/sessions', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': String(2 * 1024 * 1024 + 1), 'x-contract-version': CONTRACT_VERSION }, body: '{}' }));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const media = await app.handle(new Request('https://api.example/api/v1/identity/sessions', { method: 'POST', headers: { origin: 'https://store.example', 'content-type': 'text/plain', 'x-contract-version': CONTRACT_VERSION }, body: 'value' }));
  assert.equal(media.status, 415);
  const large = await app.handle(new Request('https://api.example/api/v1/identity/sessions', { method: 'POST', headers: { origin: 'https://store.example', 'content-type': 'application/json', 'content-length': String(2 * 1024 * 1024 + 1), 'x-contract-version': CONTRACT_VERSION }, body: '{}' }));
>>>>>>> 018b2a71 (chore(release): capture current production source)
  assert.equal(large.status, 413);
});
