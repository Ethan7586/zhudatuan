// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { LinkGateway } from '../../src/feature/link/infrastructure/LinkGateway';
import type { IdentitySdk } from '../../src/shared/api/Client';
import { bootstrapPort, environment, expectCommandContext, expectQueryContext, identitySdk } from '../TestData';

const authorization = Object.freeze({
  request: Object.freeze({ state: 'state', nonce: 'nonce', challenge: 'challenge' }),
  secret: Object.freeze({ state: 'state', nonce: 'nonce', verifier: 'verifier' }),
});

describe('LinkGateway', () => {
  it('maps generated read, create and revoke operations without exposing principal ids', async () => {
    const read = vi.fn<IdentitySdk['linksRead']>(async () => ({ items: [{ id: 'link-1', provider: 'provider-1', status: 'active' as const, version: 1 }], count: 1 }));
    const create = vi.fn<IdentitySdk['linksCreate']>(async () => ({ location: 'https://identity.example.test/authorize?state=opaque' }));
    const revoke = vi.fn<IdentitySdk['linksRevoke']>(async () => undefined);
    const gateway = new LinkGateway(identitySdk({ linksRead: read, linksCreate: create, linksRevoke: revoke }), environment, bootstrapPort(), { create: vi.fn(async () => authorization) });
    const session = Object.freeze({ target: 'storefront' as const, returnPath: '/account' });

    await expect(gateway.read(session, new AbortController().signal)).resolves.toEqual({ links: [{ id: 'link-1', provider: 'provider-1', status: 'active', version: 1 }] });
    await expect(gateway.create('provider-2', session, new AbortController().signal)).resolves.toEqual({ redirectUrl: 'https://identity.example.test/authorize?state=opaque' });
    await expect(gateway.revoke('link-1', session, new AbortController().signal)).resolves.toBeUndefined();
    expect(create.mock.calls[0]?.[0].body).toMatchObject({ providerid: 'provider-2', returntarget: 'signed-return', authorization: authorization.request });
    expect(revoke.mock.calls[0]?.[0]).toEqual({ path: { linkid: 'link-1' }, body: {} });
    expectQueryContext(read.mock.calls[0]?.[1]);
    expectCommandContext(create.mock.calls[0]?.[1]);
    expectCommandContext(revoke.mock.calls[0]?.[1]);
  });
});
