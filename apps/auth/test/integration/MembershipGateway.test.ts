// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { IdentitySdk } from '../../src/shared/api/Client';
import { MembershipGateway } from '../../src/feature/membership/infrastructure/MembershipGateway';
import { bootstrapPort, environment, expectCommandContext, expectQueryContext, identitySdk, membership } from '../TestData';

describe('MembershipGateway', () => {
  it('reads the server selection and approves only the configured target origin', async () => {
    const read = vi.fn<IdentitySdk['federationsSelectionRead']>(async () => ({ memberships: [membership], expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' as const }));
    const complete = vi.fn<IdentitySdk['federationsComplete']>(async () => ({ location: 'http://127.0.0.1:3000/orders' }));
    const gateway = new MembershipGateway(identitySdk({ federationsSelectionRead: read, federationsComplete: complete }), environment, bootstrapPort());
    const session = Object.freeze({ target: 'storefront' as const, returnPath: '/orders' });
    await expect(gateway.read(session)).resolves.toMatchObject({ memberships: [membership] });
    await expect(gateway.select('membership-1', session)).resolves.toEqual({ redirectUrl: 'http://127.0.0.1:3000/orders' });
    expect(complete.mock.calls[0]?.[0].body).toEqual({ membershipid: 'membership-1' });
    expectQueryContext(read.mock.calls[0]?.[1]);
    expectCommandContext(complete.mock.calls[0]?.[1]);
  });

  it('rejects a cross-origin completion redirect', async () => {
    const complete = vi.fn<IdentitySdk['federationsComplete']>(async () => ({ location: 'https://attacker.example/orders' }));
    const gateway = new MembershipGateway(identitySdk({ federationsComplete: complete }), environment, bootstrapPort());
    await expect(gateway.select('membership-1', { target: 'storefront' })).rejects.toThrow('RETURN_TARGET_INVALID');
  });
});
