// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { IdentitySdk } from '../../src/shared/api/Client';
import { CompleteEnrollment } from '../../src/feature/invitation/application/CompleteEnrollment';
import { InvitationGateway } from '../../src/feature/invitation/infrastructure/InvitationGateway';
import { bootstrapPort, environment, identitySdk } from '../TestData';

describe('InvitationGateway', () => {
  it('keeps an invitation secret in the request body and maps enrollment', async () => {
    const resolve = vi.fn<IdentitySdk['invitationsResolve']>(async () => ({ kind: 'enrollment' as const, enrollment: { id: 'enrollment-1', expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' as const } }));
    const gateway = new InvitationGateway(identitySdk({ invitationsResolve: resolve }), environment, bootstrapPort());
    await expect(gateway.resolve({ code: ' invite-secret ', target: 'storefront', returns: {} })).resolves.toMatchObject({ kind: 'enrollment', id: 'enrollment-1' });
    expect(resolve.mock.calls[0]?.[0].body).toMatchObject({ code: 'invite-secret' });
  });

  it('singleflights duplicate enrollment completion by enrollment id', async () => {
    let release: (() => void) | undefined;
    const complete = vi.fn(() => new Promise<{ kind: 'enrolled'; target: 'storefront' }>((resolve) => { release = () => resolve({ kind: 'enrolled', target: 'storefront' }); }));
    const usecase = new CompleteEnrollment({ resolve: vi.fn(), read: vi.fn(), complete });
    const input = { id: 'enrollment-1', subjectMode: 'bound' as const, challenge: 'challenge-1', code: '123456', termsHash: 'hash', password: 'Secret-12345!' };
    const first = usecase.execute(input);
    const second = usecase.execute(input);
    expect(first).toBe(second);
    expect(complete).toHaveBeenCalledOnce();
    release?.();
    await first;
  });
});
