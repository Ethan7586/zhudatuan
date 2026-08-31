import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { CreateChallenge } from './CreateChallenge';

describe('login challenge destination resolution', () => {
  it('sends a username challenge to the principal bound mobile for ten minutes', async () => {
    const issued = vi.fn(async (_database: OperationDatabase, value: Record<string, unknown>) => ({ id: String(value.id), purpose: String(value.purpose), expiresAt: new Date('2026-08-31T12:10:00Z') }));
    const encrypt = vi.fn(async () => ({ ciphertext: 'resolved-mobile-ciphertext', fingerprint: 'f'.repeat(64), keyVersion: 'current' }));
    const command = createCommand({ principal: 'principal:one', mobileCiphertext: 'bound-mobile-ciphertext', decrypt: '+8613800138000', issued, encrypt });

    const response = await command.lifecycle().execute(request(), database(), prepared('ethan'));

    expect(response).toMatchObject({ status: 202, body: { purpose: 'login', expires_at: '2026-08-31T12:10:00.000Z' } });
    expect(encrypt).toHaveBeenCalledWith('pii', 'identity/destination', '+8613800138000', expect.objectContaining({ purpose: 'login' }));
    expect(issued).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ principal: 'principal:one', destinationCiphertext: 'resolved-mobile-ciphertext', ttlMinutes: 10, queueDelivery: true }));
  });

  it('returns the same accepted result without queuing delivery for an unknown username', async () => {
    const issued = vi.fn(async (_database: OperationDatabase, value: Record<string, unknown>) => ({ id: String(value.id), purpose: String(value.purpose), expiresAt: new Date('2026-08-31T12:10:00Z') }));
    const command = createCommand({ principal: null, mobileCiphertext: null, decrypt: 'unknown-user', issued, encrypt: vi.fn(async () => ({ ciphertext: 'opaque-ciphertext', fingerprint: 'f'.repeat(64), keyVersion: 'current' })) });

    const response = await command.lifecycle().execute(request(), database(), prepared('unknown-user'));

    expect(response.status).toBe(202);
    expect(issued).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ principal: null, ttlMinutes: 10, queueDelivery: false }));
  });
});

function createCommand(input: Readonly<{ principal: string | null; mobileCiphertext: string | null; decrypt: string; issued: ReturnType<typeof vi.fn>; encrypt: ReturnType<typeof vi.fn> }>) {
  return new CreateChallenge(
    { decrypt: vi.fn(async () => input.decrypt), encrypt: input.encrypt } as never,
    {} as never,
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

function request() {
  return {
    type: 'identity.challenges.create',
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:challenge' },
    input: {
      path: {},
      query: {},
      headers: {},
      body: {},
      rawBody: '',
      deadline: Date.now() + 10_000,
      signal: new AbortController().signal,
      idempotency: 'challenge-create',
    },
  } as never;
}

function prepared(destination: string) {
  return {
    id: 'challenge:00000000-0000-4000-8000-000000000001',
    code: '123456',
    purpose: 'login',
    destination,
    destinationHash: 'a'.repeat(64),
    device: 'b'.repeat(64),
    peer: 'c'.repeat(64),
    envelope: { ciphertext: 'code-ciphertext', fingerprint: 'd'.repeat(64), keyVersion: 'current' },
    recipient: { ciphertext: 'requested-destination-ciphertext', fingerprint: 'e'.repeat(64), keyVersion: 'current' },
  } as never;
}

function database(): OperationDatabase {
  return { query: async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult };
}
