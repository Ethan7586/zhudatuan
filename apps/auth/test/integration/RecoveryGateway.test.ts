// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { IdentitySdk } from '../../src/shared/api/Client';
import { RecoveryGateway } from '../../src/feature/recovery/infrastructure/RecoveryGateway';
import { bootstrapPort, environment, identitySdk } from '../TestData';

describe('RecoveryGateway', () => {
  it('uses the storefront CSRF context and keeps the new password in the body', async () => {
    const reset = vi.fn<IdentitySdk['passwordReset']>(async () => ({ credentialVersion: 2, version: 2 }));
    const gateway = new RecoveryGateway(identitySdk({ passwordReset: reset }), environment, bootstrapPort());
    await gateway.reset({ challenge: 'challenge-1', code: ' 123456 ', password: 'Secret-12345!' });
    expect(reset.mock.calls[0]?.[0].body).toEqual({ challenge: 'challenge-1', code: '123456', newPassword: 'Secret-12345!' });
    expect(reset.mock.calls[0]?.[1]).toMatchObject({ target: 'storefront', csrfToken: 'csrf-token' });
  });
});
