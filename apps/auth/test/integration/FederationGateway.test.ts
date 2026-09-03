// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { IdentitySdk } from '../../src/shared/api/Client';
import { FederationGateway } from '../../src/feature/federation/infrastructure/FederationGateway';
import { AuthorizationFactory } from '../../src/shared/security/Authorization';
import { bootstrapPort, environment, identitySdk } from '../TestData';

describe('FederationGateway', () => {
  it('loads only enabled provider DTOs and starts a server-bound authorization', async () => {
    const providers = vi.fn<IdentitySdk['providersRead']>(async () => ({ items: [{ id: 'provider-1', type: 'oidc' as const, status: 'enabled' as const }] }));
    const start = vi.fn<IdentitySdk['federationsStart']>(async () => ({ location: 'https://identity.example.com/authorize?state=opaque' }));
    const gateway = new FederationGateway(identitySdk({ providersRead: providers, federationsStart: start }), environment, bootstrapPort(), new AuthorizationFactory());
    await expect(gateway.read('storefront')).resolves.toEqual([{ id: 'provider-1', type: 'oidc' }]);
    await expect(gateway.start('provider-1', 'storefront', {})).resolves.toEqual({ redirectUrl: 'https://identity.example.com/authorize?state=opaque' });
    expect(start.mock.calls[0]?.[0].body).toMatchObject({ providerid: 'provider-1', returntarget: 'signed-return' });
  });

  it('rejects an insecure identity provider redirect', async () => {
    const start = vi.fn<IdentitySdk['federationsStart']>(async () => ({ location: 'http://identity.example.com/authorize' }));
    const gateway = new FederationGateway(identitySdk({ federationsStart: start }), environment, bootstrapPort(), new AuthorizationFactory());
    await expect(gateway.start('provider-1', 'storefront', {})).rejects.toThrow('CONTRACT_INVALID');
  });
});
