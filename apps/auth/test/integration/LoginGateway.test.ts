// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { IdentitySdk } from '../../src/shared/api/Client';
import { LoginGateway } from '../../src/feature/login/infrastructure/LoginGateway';
import { AuthorizationFactory } from '../../src/shared/security/Authorization';
import { bootstrapPort, environment, expectCommandContext, identitySdk, membership } from '../TestData';

describe('LoginGateway', () => {
  it('submits a trimmed password in the body and preserves a membership outcome', async () => {
    const create = vi.fn<IdentitySdk['sessionsCreate']>(async () => ({ kind: 'selection' as const, transaction: 'selection-1', memberships: [membership] }));
    const gateway = new LoginGateway(identitySdk({ sessionsCreate: create }), environment, bootstrapPort(), new AuthorizationFactory());
    await expect(gateway.authenticate({ kind: 'password', subject: ' employee ', password: 'Secret-12345!', session: { target: 'storefront', returnPath: '/orders' } })).resolves.toMatchObject({ kind: 'membership' });
    const input = create.mock.calls[0]?.[0];
    expect(input?.body).toMatchObject({ method: 'password', subject: 'employee', password: 'Secret-12345!', target: 'storefront' });
    expect(JSON.stringify(input)).not.toContain('returnpath');
    expectCommandContext(create.mock.calls[0]?.[1]);
  });
});
