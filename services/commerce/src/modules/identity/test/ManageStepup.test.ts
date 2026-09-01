import { describe, expect, it, vi } from 'vitest';
import { result, withReadTransaction } from '../../../test/TransactionFixture';
import { ManageStepup } from '../application/service/ManageStepup';

describe('secondary verification destination', () => {
  it('rejects an account without a bound mobile using the public contract', async () => {
    const service = new ManageStepup(
      { securityProfile: vi.fn(async () => ({ mobileCiphertext: null, mobileFingerprint: null })) } as never,
      {} as never,
      {} as never,
      'identity-key-with-at-least-thirty-two-bytes',
      'session-key-with-at-least-thirty-two-bytes',
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );

    await expect(
      withReadTransaction(
        async () => result([]),
        (context) => service.start().load!(request(), context)
      )
    ).rejects.toMatchObject({ code: 'STEPUP_DESTINATION_MISSING', result: { status: 409, body: { code: 'STEPUP_DESTINATION_MISSING' } } });
  });
});

function request() {
  return {
    type: 'identity.stepup.start',
    input: { path: {}, query: {}, headers: {}, body: {}, rawBody: '', deadline: Date.now() + 10_000, signal: new AbortController().signal, idempotency: 'stepup-start' },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 1 } },
        membership: { id: 'membership:one', permissions: { allows: new Set(['identity.assurance.manage']), denies: new Set() }, scopes: [], active: true, accessVersion: 1 },
        organization: 'self:one',
        scope: { kind: 'self', id: 'self:one', path: [] },
        capabilities: new Set(['identity.stepup.start']),
        capabilityVersion: 1,
        accessVersion: 1,
        assurance: { level: 1 },
        trace: 'trace:stepup',
      },
    },
  } as never;
}
