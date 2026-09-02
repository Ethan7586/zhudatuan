import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationRequest';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { InvitationFailure } from './InvitationFailure';
import { result, withWriteTransaction } from '../../../../test/TransactionFixture';

describe('InvitationFailure', () => {
  it('publishes a bounded failure event without request secrets and returns the public error', async () => {
    const publish = vi.fn();
    const failure = new InvitationFailure({ publish } as never);
    let context: unknown;
    await expect(
      withWriteTransaction(
        async () => result([]),
        async (transaction) => {
          context = transaction;
          return failure.reject(transaction, request(), 'invitation:one', 'mall:one', new DomainError('INVITATION_STALE'), 'INVITATION_INVALID');
        }
      )
    ).rejects.toMatchObject({ code: 'INVITATION_INVALID' });

    expect(publish).toHaveBeenCalledWith(context, 'identity.invitation.failed', 'invitation', 'invitation:one', 'mall:one', 'trace:one', {
      invitationId: 'invitation:one',
      operation: 'identity.invitations.resolve',
      reason: 'INVITATION_STALE',
    });
    const event = JSON.stringify(publish.mock.calls);
    expect(event).not.toContain('INVITE-SECRET');
    expect(event).not.toContain('123456');
  });
});

function request(): OperationRequest {
  return {
    type: 'identity.invitations.resolve',
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:one' },
    input: {
      path: {},
      query: {},
      headers: { 'x-trace-id': 'trace:one' },
      body: { code: 'INVITE-SECRET', target: 'storefront', returnTarget: 'signed-target' },
      rawBody: '{"code":"INVITE-SECRET","target":"storefront","returnTarget":"signed-target"}',
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
      idempotency: 'invitation:failure',
      publicActor: `public:${'a'.repeat(64)}`,
    },
  };
}
