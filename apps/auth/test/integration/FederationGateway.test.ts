// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { IdentitySdk } from '../../src/shared/api/Client';
import { FederationGateway } from '../../src/feature/federation/infrastructure/FederationGateway';
import { AuthorizationFactory } from '../../src/shared/security/Authorization';
import { bootstrapPort, environment, expectCommandContext, expectQueryContext, identitySdk } from '../TestData';

describe('FederationGateway', () => {
  it('loads only enabled provider DTOs and starts a server-bound authorization', async () => {
    const providers = vi.fn<IdentitySdk['providersRead']>(async () => ({ items: [{ id: 'provider-1', type: 'oidc' as const, status: 'enabled' as const }] }));
    const start = vi.fn<IdentitySdk['federationsStart']>(async () => ({ location: 'https://identity.example.com/authorize?state=opaque' }));
    const gateway = new FederationGateway(identitySdk({ providersRead: providers, federationsStart: start }), environment, bootstrapPort(), new AuthorizationFactory());
    const session = Object.freeze({ target: 'storefront' as const, returnPath: '/orders' });
    await expect(gateway.read(session)).resolves.toEqual([{ id: 'provider-1', type: 'oidc' }]);
    await expect(gateway.start('provider-1', session)).resolves.toEqual({ redirectUrl: 'https://identity.example.com/authorize?state=opaque' });
    expect(providers.mock.calls[0]?.[0]).toEqual({ query: { returntarget: 'signed-return' } });
    expect(start.mock.calls[0]?.[0].body).toMatchObject({ providerid: 'provider-1', returntarget: 'signed-return' });
    expectQueryContext(providers.mock.calls[0]?.[1]);
    expectCommandContext(start.mock.calls[0]?.[1]);
  });

  it('rejects an insecure identity provider redirect', async () => {
    const start = vi.fn<IdentitySdk['federationsStart']>(async () => ({ location: 'http://identity.example.com/authorize' }));
    const gateway = new FederationGateway(identitySdk({ federationsStart: start }), environment, bootstrapPort(), new AuthorizationFactory());
    await expect(gateway.start('provider-1', { target: 'storefront' })).rejects.toThrow('CONTRACT_INVALID');
  });
});
