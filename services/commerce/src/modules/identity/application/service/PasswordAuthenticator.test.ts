import { describe, expect, it, vi } from 'vitest';
import type { OperationInputFor } from '@shop/contract';
import type { OperationRequest } from '../../../../pipeline/OperationRequest';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CredentialRepository } from '../port/CredentialRepository';
import type { LoginGuardPort } from '../port/ChallengePort';
import { PasswordAuthenticator } from './PasswordAuthenticator';

describe('PasswordAuthenticator preparation', () => {
  it('derives the password before the write transaction and revalidates the credential inside it', async () => {
    const matchPassword = vi.fn(async () => ({ id: 'credential:one', principal: 'principal:one', secretHash: 'encoded', version: 7 }));
    const confirmPassword = vi.fn(async () => false);
    const verify = vi.fn(async () => true);
    const assertAllowed = vi.fn(async () => undefined);
    const credentials = { matchPassword, confirmPassword } as unknown as CredentialRepository;
    const guard = { assertAllowed, recordFailure: vi.fn(), clear: vi.fn() } as unknown as LoginGuardPort;
    const authenticator = new PasswordAuthenticator(
      'k'.repeat(32),
      {} as never,
      { verify: () => ({ target: 'storefront', proof: 'return:proof' }) } as never,
      {} as never,
      guard,
      {} as never,
      {} as never,
      {} as never,
      credentials,
      { verify } as never
    );
    const input = authenticationInput();
    const request = authenticationRequest(input);

    const loaded = await authenticator.load(request, { mode: 'read' } as ReadTransactionContext, input.body);
    expect(matchPassword).toHaveBeenCalledOnce();
    expect(verify).not.toHaveBeenCalled();
    expect(confirmPassword).not.toHaveBeenCalled();

    const prepared = await loaded.prepare(request, input.body);
    expect(verify).toHaveBeenCalledWith('ValidPassword1!', 'encoded');
    expect(confirmPassword).not.toHaveBeenCalled();
    expect(JSON.stringify(prepared)).not.toContain('encoded');

    await expect(prepared.authenticate(request, { mode: 'write' } as WriteTransactionContext)).rejects.toThrow('CREDENTIAL_INVALID');
    expect(assertAllowed).toHaveBeenCalledOnce();
    expect(confirmPassword).toHaveBeenCalledWith(expect.anything(), { id: 'credential:one', principal: 'principal:one', version: 7 });
    expect(matchPassword.mock.invocationCallOrder[0]).toBeLessThan(verify.mock.invocationCallOrder[0]!);
    expect(verify.mock.invocationCallOrder[0]).toBeLessThan(confirmPassword.mock.invocationCallOrder[0]!);
  });
});

function authenticationInput(): OperationInputFor<'identity.sessions.create'> {
  return {
    body: {
      method: 'password',
      subject: 'ethan',
      password: 'ValidPassword1!',
      target: 'storefront',
      returnTarget: 'return:proof',
      authorization: { state: 's'.repeat(32), nonce: 'n'.repeat(32), challenge: 'c'.repeat(43) },
    },
  };
}

function authenticationRequest(input: OperationInputFor<'identity.sessions.create'>): OperationRequest {
  return {
    type: 'identity.sessions.create',
    input: {
      path: {},
      query: {},
      headers: { 'x-device-id': 'device:test', 'x-trace-id': 'trace:test' },
      body: input.body,
      rawBody: '',
      deadline: Date.now() + 10_000,
      signal: new AbortController().signal,
      idempotency: 'idempotency:test',
    },
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:test' },
  };
}
