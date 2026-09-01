import { describe, expect, it, vi } from 'vitest';
import { FederationService } from '../application/service/FederationService';
import { FederationTransaction } from '../domain/model/FederationTransaction';
import { FederatedSubject } from '../domain/model/FederatedSubject';
import { FederationProtector } from '../domain/service/FederationProtector';
import { NonceService } from '../domain/service/NonceService';
import { SubjectHasher } from '../domain/service/SubjectHasher';
import { ProviderInstance } from '../domain/model/ProviderInstance';
import { SessionCookieAdapter } from '../infrastructure/security/SessionCookie';
import { result, withReadTransaction, withWriteTransaction } from '../../../test/TransactionFixture';

const PROVIDER = '11111111-1111-4111-8111-111111111111';
const TENANT = '22222222-2222-4222-8222-222222222222';
const TRANSACTION = '33333333-3333-4333-8333-333333333333';
const protector = new FederationProtector('federation-test-key-that-is-at-least-32-characters');
const nonces = new NonceService();
const context = Object.freeze({ peer: '203.0.113.7', agent: 'browser', device: 'device:one', trace: 'trace:one' });

describe('FederationService callback', () => {
  it('creates a manual link only from a provider-verified callback bound to the current identity', async () => {
    const transaction = new FederationTransaction({
      id: TRANSACTION,
      provider: PROVIDER,
      state: 'redirected',
      version: 1,
      expiresat: new Date(Date.now() + 60_000),
      target: 'console',
      purpose: 'link',
      principal: 'principal:one',
      membership: 'membership:one',
    });
    const repository = {
      pending: vi.fn(async () => ({
        transaction,
        noncehash: Buffer.alloc(32, 1),
        verifierciphertext: 'verifier-envelope',
        returntarget: 'signed-return-target',
        browserhash: protector.browser(context.peer, context.agent, context.device),
        authorization: { stateHash: Buffer.alloc(32), nonceHash: Buffer.alloc(32), challenge: 'a'.repeat(43) },
      })),
      accept: vi.fn(async () => transaction.transition('callbackreceived', new Date())),
      verified: vi.fn(async () => ({ principal: null, conflict: false, memberships: [] })),
      complete: vi.fn(async () => undefined),
    };
    const instance = new ProviderInstance({
      id: PROVIDER,
      type: 'oidc',
      tenantid: TENANT,
      issuer: 'https://issuer.example',
      clientid: 'client',
      secretref: 'identity/oidc/client',
      status: 'enabled',
      redirecturi: `https://api.zhudatuan.com/api/v1/identity/federations/${PROVIDER}/callback`,
      scopes: ['openid'],
      version: 1,
      createdat: '2026-08-30T00:00:00.000Z',
      updatedat: '2026-08-30T00:00:00.000Z',
    });
    const links = { create: vi.fn(async () => ({ id: 'link:one' })) };
    const kms = {
      decrypt: vi.fn(async () => 'pkce-verifier'),
      encrypt: vi.fn(async () => ({ ciphertext: 'subject-envelope', keyVersion: 'current' })),
    };
    const service = new FederationService(
      repository as never,
      {} as never,
      {
        require: vi.fn(async () => ({
          instance,
          strategy: { callback: vi.fn(async () => new FederatedSubject({ provider: 'oidc', instance: PROVIDER, tenant: TENANT, subject: 'provider-subject', assurance: 2, claims: {} })) },
        })),
      } as never,
      new SubjectHasher({ version: 'current', value: 'subject-test-key-that-is-at-least-32-characters' }),
      protector,
      nonces,
      kms as never,
      { issue: vi.fn() } as never,
      { verify: vi.fn(() => ({ url: 'https://console.zhudatuan.com/security', proof: 'proof', expiresAt: '2026-08-30T00:01:00.000Z', target: 'console' })) } as never,
      { directoryBindings: vi.fn() } as never,
      {} as never,
      new SessionCookieAdapter(),
      links as never
    );

    const response = await callback(service);

    expect(response).toMatchObject({ status: 303, headers: { location: 'https://console.zhudatuan.com/security' } });
    expect(kms.encrypt).toHaveBeenCalledWith('pii', 'identity/federatedsubject', 'provider-subject', { principal: 'principal:one', provider: PROVIDER });
    expect(links.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ principal: 'principal:one', membership: 'membership:one', provider: PROVIDER, ciphertext: 'subject-envelope' }));
    expect(repository.complete).toHaveBeenCalledWith(expect.anything(), TRANSACTION, 3);
  });

  it('creates the target-bound session and redirects without putting credentials in the URL', async () => {
    const transaction = new FederationTransaction({
      id: TRANSACTION,
      provider: PROVIDER,
      state: 'redirected',
      version: 1,
      expiresat: new Date(Date.now() + 60_000),
      target: 'console',
      purpose: 'signin',
      principal: null,
      membership: null,
    });
    const repository = {
      pending: vi.fn(async () => ({
        transaction,
        noncehash: Buffer.alloc(32, 1),
        verifierciphertext: 'ciphertext',
        returntarget: 'signed-return-target',
        browserhash: protector.browser(context.peer, context.agent, context.device),
        authorization: { stateHash: Buffer.alloc(32), nonceHash: Buffer.alloc(32), challenge: 'a'.repeat(43) },
      })),
      accept: vi.fn(async () => transaction.transition('callbackreceived', new Date())),
      verified: vi.fn(async () => ({ principal: 'principal:one', conflict: false, memberships: [{ id: 'membership:one', name: 'Console', target: 'console' as const }] })),
      complete: vi.fn(async () => undefined),
    };
    const instance = new ProviderInstance({
      id: PROVIDER,
      type: 'oidc',
      tenantid: TENANT,
      issuer: 'https://issuer.example',
      clientid: 'client',
      secretref: 'identity/oidc/client',
      status: 'enabled',
      redirecturi: `https://api.zhudatuan.com/api/v1/identity/federations/${PROVIDER}/callback`,
      scopes: ['openid'],
      version: 1,
      createdat: '2026-08-30T00:00:00.000Z',
      updatedat: '2026-08-30T00:00:00.000Z',
    });
    const subject = new FederatedSubject({ provider: 'oidc', instance: PROVIDER, tenant: TENANT, subject: 'subject:one', assurance: 2, claims: {} });
    const provider = { callback: vi.fn(async () => subject) };
    const service = new FederationService(
      repository as never,
      {} as never,
      { require: vi.fn(async () => ({ instance, strategy: provider })) } as never,
      new SubjectHasher({ version: 'current', value: 'subject-test-key-that-is-at-least-32-characters' }),
      protector,
      nonces,
      { decrypt: vi.fn(async () => 'pkce-verifier'), encrypt: vi.fn(async () => ({ ciphertext: 'subject-envelope', keyVersion: 'current' })) } as never,
      {
        issue: vi.fn(async () => ({ session: 'session:one', membership: 'membership:one', target: 'console', expiresin: 3600, headers: { 'set-cookie': '__Host-console-session=opaque; Path=/; Secure; HttpOnly; SameSite=Strict' } })),
      } as never,
      { issue: vi.fn(() => ({ url: 'https://console.zhudatuan.com', proof: 'proof', expiresAt: '2026-08-30T00:01:00.000Z', target: 'console' })) } as never,
      { directoryBindings: vi.fn() } as never,
      {} as never,
      new SessionCookieAdapter(),
      {} as never
    );

    const response = await callback(service);

    expect(response.status).toBe(303);
    expect(response.headers?.location).toBe('https://console.zhudatuan.com');
    expect(response.headers?.['set-cookie']).toContain('__Host-console-session=opaque');
    const location = new URL(response.headers!.location!);
    expect(location.search).toBe('');
    expect(location.hash).toBe('');
    expect(response.headers!.location).not.toMatch(/ticket|token|code|proof|complete/i);
    expect(repository.complete).toHaveBeenCalledWith(expect.anything(), TRANSACTION, 3);
  });

  it('redirects multi-membership users with only a target hint and an HttpOnly preauth cookie', async () => {
    const transaction = new FederationTransaction({
      id: TRANSACTION,
      provider: PROVIDER,
      state: 'redirected',
      version: 1,
      expiresat: new Date(Date.now() + 60_000),
      target: 'console',
      purpose: 'signin',
      principal: null,
      membership: null,
    });
    const repository = {
      pending: vi.fn(async () => ({
        transaction,
        noncehash: Buffer.alloc(32, 1),
        verifierciphertext: 'ciphertext',
        returntarget: 'signed-secret-return-target',
        browserhash: protector.browser(context.peer, context.agent, context.device),
        authorization: { stateHash: Buffer.alloc(32), nonceHash: Buffer.alloc(32), challenge: 'a'.repeat(43) },
      })),
      accept: vi.fn(async () => transaction.transition('callbackreceived', new Date())),
      verified: vi.fn(async () => ({
        principal: 'principal:one',
        conflict: false,
        memberships: [
          { id: 'membership:one', name: 'Console one', target: 'console' as const },
          { id: 'membership:two', name: 'Console two', target: 'console' as const },
        ],
      })),
      preauthorize: vi.fn(async () => ({ token: 'p'.repeat(64) })),
    };
    const instance = new ProviderInstance({
      id: PROVIDER,
      type: 'oidc',
      tenantid: TENANT,
      issuer: 'https://issuer.example',
      clientid: 'client',
      secretref: 'identity/oidc/client',
      status: 'enabled',
      redirecturi: `https://api.zhudatuan.com/api/v1/identity/federations/${PROVIDER}/callback`,
      scopes: ['openid'],
      version: 1,
      createdat: '2026-08-30T00:00:00.000Z',
      updatedat: '2026-08-30T00:00:00.000Z',
    });
    const service = new FederationService(
      repository as never,
      {} as never,
      { require: vi.fn(async () => ({ instance, strategy: { callback: vi.fn(async () => new FederatedSubject({ provider: 'oidc', instance: PROVIDER, tenant: TENANT, subject: 'subject:one', assurance: 2, claims: {} })) } })) } as never,
      new SubjectHasher({ version: 'current', value: 'subject-test-key-that-is-at-least-32-characters' }),
      protector,
      nonces,
      { decrypt: vi.fn(async () => 'pkce-verifier'), encrypt: vi.fn(async () => ({ ciphertext: 'subject-envelope', keyVersion: 'current' })) } as never,
      {} as never,
      {} as never,
      { directoryBindings: vi.fn() } as never,
      {} as never,
      new SessionCookieAdapter(),
      {} as never
    );

    const response = await callback(service);
    const location = new URL(response.headers!.location!);
    expect(location.pathname).toBe('/membership');
    expect([...location.searchParams.entries()]).toEqual([
      ['target', 'console'],
      ['state', 'selectionrequired'],
    ]);
    expect(response.headers?.['set-cookie']).toContain('__Host-preauth=');
    expect(response.headers!.location).not.toContain('signed-secret-return-target');
  });
});

async function callback(service: FederationService) {
  const input = Object.freeze({ provider: PROVIDER, state: nonces.issue(), code: 'provider-code' });
  const loaded = await withReadTransaction(
    async () => result([]),
    (transaction) => service.loadCallback(transaction, input, context)
  );
  const prepared = await service.prepareCallback(input, loaded, context);
  return withWriteTransaction(
    async () => result([]),
    (transaction) => service.commitCallback(transaction, prepared)
  );
}
