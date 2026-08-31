import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationExecution';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { InvitationFailure } from './InvitationFailure';

describe('InvitationFailure', () => {
  it('publishes a bounded failure event without request secrets and returns the public error', async () => {
    const publish = vi.fn();
    const failure = new InvitationFailure({ publish } as never);
    const database = { query: vi.fn() } as unknown as OperationDatabase;

    await expect(failure.reject(database, request(), 'invitation:one', 'mall:one', new DomainError('INVITATION_STALE'), 'INVITATION_INVALID')).rejects.toMatchObject({ code: 'INVITATION_INVALID' });

    expect(publish).toHaveBeenCalledWith(database, 'identity.invitation.failed', 'invitation', 'invitation:one', 'mall:one', 'trace:one', {
      invitationId: 'invitation:one',
      operation: 'identity.sessions.create',
      reason: 'INVITATION_STALE',
    });
    const event = JSON.stringify(publish.mock.calls);
    expect(event).not.toContain('INVITE-SECRET');
    expect(event).not.toContain('123456');
  });
});

function request(): OperationRequest {
  return {
    type: 'identity.sessions.create',
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:one' },
    input: {
      path: {},
      query: {},
      headers: { 'x-trace-id': 'trace:one' },
      body: { method: 'invitation', code: 'INVITE-SECRET', proof: '123456' },
      rawBody: '{"method":"invitation","code":"INVITE-SECRET","proof":"123456"}',
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
      idempotency: 'invitation:failure',
      publicActor: `public:${'a'.repeat(64)}`,
    },
  };
}
