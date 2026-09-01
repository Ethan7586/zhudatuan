import { describe, expect, it, vi } from 'vitest';
import { CreateChallenge } from '../application/service/CreateChallenge';
import { result, withReadTransaction, withWriteTransaction } from '../../../test/TransactionFixture';

describe('login challenge destination resolution', () => {
  it('sends a username challenge to the principal bound mobile for ten minutes', async () => {
    const issued = vi.fn(async (_context: unknown, value: Record<string, unknown>) => ({ id: String(value.id), purpose: String(value.purpose), expiresAt: new Date('2026-08-31T12:10:00Z') }));
    const encrypt = vi.fn(async () => ({ ciphertext: 'resolved-mobile-ciphertext', fingerprint: 'f'.repeat(64), keyVersion: 'current' }));
    const command = createCommand({ principal: 'principal:one', mobileCiphertext: 'bound-mobile-ciphertext', decrypt: '+8613800138000', issued, encrypt });

    const response = await execute(command, request('ethan'));

    expect(response).toMatchObject({ status: 202, body: { purpose: 'login', expires_at: '2026-08-31T12:10:00.000Z' } });
    expect(encrypt).toHaveBeenCalledWith('pii', 'identity/destination', '+8613800138000', expect.objectContaining({ purpose: 'login' }));
    expect(issued).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ principal: 'principal:one', destinationCiphertext: 'resolved-mobile-ciphertext', ttlMinutes: 10, queueDelivery: true }));
  });

  it('returns the same accepted result without queuing delivery for an unknown username', async () => {
    const issued = vi.fn(async (_context: unknown, value: Record<string, unknown>) => ({ id: String(value.id), purpose: String(value.purpose), expiresAt: new Date('2026-08-31T12:10:00Z') }));
    const command = createCommand({ principal: null, mobileCiphertext: null, decrypt: 'unknown-user', issued, encrypt: vi.fn(async () => ({ ciphertext: 'opaque-ciphertext', fingerprint: 'f'.repeat(64), keyVersion: 'current' })) });

    const response = await execute(command, request('unknown-user'));

    expect(response.status).toBe(202);
    expect(issued).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ principal: null, ttlMinutes: 10, queueDelivery: false }));
  });
});

function createCommand(input: Readonly<{ principal: string | null; mobileCiphertext: string | null; decrypt: string; issued: ReturnType<typeof vi.fn>; encrypt: ReturnType<typeof vi.fn> }>) {
  return new CreateChallenge(
    { decrypt: vi.fn(async () => input.decrypt), encrypt: input.encrypt } as never,
    { evaluate: vi.fn(async () => ({ outcome: 'allow', safeReason: 'policy', decision: null })) } as never,
    { throttle: vi.fn(), issue: input.issued } as never,
    'identity-key-with-at-least-thirty-two-bytes',
    'session-key-with-at-least-thirty-two-bytes',
    {} as never,
    {} as never,
    {} as never,
    { publish: vi.fn() } as never,
    { principalForSubject: vi.fn(async () => input.principal) } as never,
    { securityProfile: vi.fn(async () => ({ mobileCiphertext: input.mobileCiphertext, mobileFingerprint: null })) } as never
  );
}

function request(destination: string) {
  return {
    type: 'identity.challenges.create',
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:challenge' },
    input: {
      path: {},
      query: {},
      headers: {},
      body: { purpose: 'login', destination },
      rawBody: '',
      deadline: Date.now() + 10_000,
      signal: new AbortController().signal,
      idempotency: 'challenge-create',
    },
  } as never;
}

async function execute(command: CreateChallenge, operation: ReturnType<typeof request>) {
  const lifecycle = command.lifecycle();
  const loaded = await withReadTransaction(
    async () => result([]),
    (context) => lifecycle.load!(operation, context)
  );
  const prepared = await lifecycle.prepare!(operation, loaded);
  return withWriteTransaction(
    async () => result([]),
    (context) => lifecycle.execute(operation, context, prepared)
  );
}
