import { describe, expect, it } from 'vitest';
import { mapInvitation } from '../../src/feature/invitation/infrastructure/InvitationMapper';

describe('invitation contract', () => {
  it('accepts only explicit invitation outcome variants', () => {
    expect(mapInvitation({ kind: 'enrollment', enrollment: { id: 'enrollment-1', expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' } })).toMatchObject({ kind: 'enrollment' });
    expect(mapInvitation({ kind: 'proofRequired', proof: { reference: 'proof-1', purpose: 'invitation_login', expiresAt: '2099-01-01T00:10:00.000Z', retryAt: '2099-01-01T00:00:30.000Z', attemptsRemaining: 10, method: 'otp', target: 'storefront' } })).toMatchObject({ kind: 'proof', challenge: { purpose: 'invitation_login', attemptsRemaining: 10 } });
  });
});
