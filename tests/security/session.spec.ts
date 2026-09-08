import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTRACT_VERSION, OperationCatalog } from '@shop/contract';
import { Redactor } from '@shop/telemetry';
import { RouteRegistry } from '../../services/commerce/src/composition/RouteRegistry';
import { SecureOperationPolicy } from '../../services/commerce/src/pipeline/OperationPolicy';
import { HttpApp } from '../../services/commerce/src/platform/http/HttpApp';
import { CsrfProtector } from '../../services/commerce/src/platform/security/CsrfProtector';
import { DomainError } from '../../services/commerce/src/platform/error/DomainError';
import { sessionCookies } from '../../services/commerce/src/modules/identity/infrastructure/security/SessionCookie';
import { NavigationKey } from '../../services/commerce/src/modules/navigation/domain/model/NavigationKey';
import { RUNTIME_LIMITS } from '@shop/config/runtime';

test('optional session never downgrades an invalid credential to an anonymous request', async () => {
  let accessCalls = 0;
  let publicRiskCalls = 0;
  const policy = new SecureOperationPolicy(
    {
      authorize: async () => {
        accessCalls += 1;
        throw new DomainError('AUTHENTICATION_REQUIRED');
      },
    } as never,
    {} as never,
    {
      evaluate: async () => {
        publicRiskCalls += 1;
        return { outcome: 'allow', safeReason: 'policy', decision: null } as const;
      },
    },
    { append: async () => undefined }
  );
  const operation = OperationCatalog.get('storefront.bootstrap.read');
  await assert.rejects(policy.authorize({ operation, input: {}, headers: { 'x-client-target': 'storefront', cookie: '__Host-storefront-session=invalid-session-token-value-000001' } }), /AUTHENTICATION_REQUIRED/);
  assert.equal(accessCalls, 1);
  assert.equal(publicRiskCalls, 0);
  await assert.doesNotReject(policy.authorize({ operation, input: {}, headers: { 'x-client-target': 'storefront' } }));
  assert.equal(publicRiskCalls, 1);
});

test('session cookies are host-only, secure, HttpOnly and SameSite Strict', () => {
  const sessionSeconds = RUNTIME_LIMITS.authentication.session.ttlSeconds;
  const values = sessionCookies('storefront', 's'.repeat(32), 'c'.repeat(43), sessionSeconds, sessionSeconds);
  assert.match(values['set-cookie']!, /^__Host-storefront-session=/);
  assert.match(values['set-cookie']!, /; Path=\/;.*; Secure; HttpOnly; SameSite=Strict/);
  assert.doesNotMatch(values['set-cookie']!, /Domain=/i);
  assert.match(values['x-set-cookie']!, /^__Host-storefront-csrf=/);
  assert.match(values['x-set-cookie']!, /; Secure; SameSite=Strict/);
  assert.doesNotMatch(values['x-set-cookie']!, /HttpOnly|Domain=/i);
  assert.match(values['set-cookie']!, /Max-Age=7200/);
  assert.throws(() => sessionCookies('storefront', 's'.repeat(32), 'c'.repeat(43), sessionSeconds + 1, sessionSeconds), /SESSION_COOKIE_INVALID/);
});

test('PII is rejected from URLs, redacted from telemetry and HMACed in cache keys', async () => {
  const registry = new RouteRegistry();
  for (const operation of OperationCatalog.all()) registry.register({ operation: operation.id, handler: async () => ({ status: 200, body: { accepted: true } }) });
  registry.freeze();
  const app = new HttpApp(registry, ['https://store.example'], new CsrfProtector('security-test-csrf-key-material-32-bytes', { storefront: 'https://store.example', console: 'https://console.example' }));
  const response = await app.handle(
    new Request('https://api.example/api/v1/storefront/catalog?mobile=13800138000', {
      headers: { 'x-client-target': 'storefront', 'x-contract-version': CONTRACT_VERSION },
    })
  );
  assert.equal(response.status, 400);
  assert.equal(((await response.json()) as { code: string }).code, 'URL_SENSITIVE_DATA_FORBIDDEN');

  const redacted = JSON.stringify(new Redactor().redact({ authorization: 'Bearer secret', mobile: '13800138000', note: 'mail member@example.com' }));
  assert.doesNotMatch(redacted, /secret|13800138000|member@example\.com/);
  const key = new NavigationKey('navigation-security-key-material-32-bytes', {
    catalog: 'catalog:one',
    target: 'storefront',
    principal: 'principal:secret',
    membership: 'membership:secret',
    scope: 'mall:secret',
    accessVersion: 7,
    capabilityVersion: 9,
  });
  assert.doesNotMatch([key.cache, ...key.indexes].join('\n'), /principal:secret|membership:secret|mall:secret/);
});
