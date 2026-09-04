// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { IdentitySdk } from '../../src/shared/api/Client';
import { InvitationGateway } from '../../src/feature/invitation/infrastructure/InvitationGateway';
import { bootstrapPort, environment, expectCommandContext, identitySdk } from '../TestData';

describe('InvitationGateway', () => {
  it('keeps an invitation secret in the request body and maps enrollment', async () => {
    const resolve = vi.fn<IdentitySdk['invitationsResolve']>(async () => ({ kind: 'enrollment' as const, enrollment: { id: 'enrollment-1', expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' as const } }));
    const gateway = new InvitationGateway(identitySdk({ invitationsResolve: resolve }), environment, bootstrapPort());
    await expect(gateway.resolve({ code: ' invite-secret ', session: { target: 'storefront', returnPath: '/welcome' } })).resolves.toMatchObject({ kind: 'enrollment', id: 'enrollment-1' });
    expect(resolve.mock.calls[0]?.[0].body).toMatchObject({ code: 'invite-secret' });
    expectCommandContext(resolve.mock.calls[0]?.[1]);
  });
});
