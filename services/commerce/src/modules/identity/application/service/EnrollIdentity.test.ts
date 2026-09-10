import { describe, expect, it, vi } from 'vitest';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { withWriteTransaction } from '../../../../test/TransactionFixture';
import { Invitation } from '../../domain/model/Invitation';
import { SessionCookieAdapter } from '../../infrastructure/security/SessionCookie';
import { EnrollIdentity } from './EnrollIdentity';

describe('EnrollIdentity', () => {
  it('resolves a root storefront destination against the newly activated membership', async () => {
    const invitation = employeeInvitation();
    const repository = {
      lockClaimed: vi.fn(async () => invitation),
      claim: vi.fn(async () => ({
        id: 'claim:employee',
        invitation: invitation.state.id,
        kind: 'enrollment',
        target: 'storefront',
        recipientHash: Buffer.alloc(32, 2),
        state: 'proofpending',
        proof: 'otp',
        expiresAt: new Date(Date.now() + 60_000),
        provedAt: null,
        version: 1,
      })),
    };
    const access = { pending: vi.fn(async () => 'member:employee'), activate: vi.fn(async () => ({ activationDigest: 'a'.repeat(64) })) };
    const members = {
      lockMobile: vi.fn(),
      mobileOwner: vi.fn(async () => null),
      lockPending: vi.fn(async () => ({ principal: 'principal:employee', member: 'member:employee' })),
      activate: vi.fn(),
    };
    const sessions = { issue: vi.fn(async () => ({ session: 'session:employee', headers: { 'set-cookie': 'session-cookie' } })) };
    const tickets = { issue: vi.fn(async () => ({ ticket: 'ticket:employee' })) };
    const destinations = {
      resolve: vi.fn(async () => ({
        url: 'http://127.0.0.1:3000/s/zhudatuan-local',
        proof: 'mall-return-proof',
        expiresAt: '2099-01-01T00:00:00.000Z',
        target: 'storefront' as const,
      })),
    };
    const redeemer = { validate: vi.fn(), consume: vi.fn() };
    const enrollment = new EnrollIdentity(
      repository as never,
      access as never,
      members as never,
      sessions as never,
      { matchesRecipient: vi.fn(() => true) } as never,
      'identity-key-value-at-least-thirty-two-bytes',
      'session-key-value-at-least-thirty-two-bytes',
      tickets as never,
      destinations as never,
      { consume: vi.fn() } as never,
      {} as never,
      redeemer as never,
      new SessionCookieAdapter(RUNTIME_LIMITS.authentication.session.ttlSeconds),
      { metrics: { count: vi.fn(), duration: vi.fn() } } as never,
      { findPrincipal: vi.fn(async () => null), activatePrincipal: vi.fn(), createPassword: vi.fn() } as never,
      { record: vi.fn() } as never,
      { publish: vi.fn() } as never,
      { record: vi.fn(), reject: vi.fn() } as never
    );
    let transaction: unknown;
    const response = await withWriteTransaction(
      async () => result(),
      async (context) => {
        transaction = context;
        return enrollment.complete(request(), context, prepared());
      }
    );

    expect(response).toMatchObject({ status: 201, body: { kind: 'session', ticket: 'ticket:employee', returnTarget: 'mall-return-proof' } });
    expect(destinations.resolve).toHaveBeenCalledWith(transaction, {
      target: 'storefront',
      returnTarget: 'root-return-proof',
      organization: 'mall-zhudatuan',
    });
    expect(tickets.issue).toHaveBeenCalledWith(transaction, 'session:employee', 'storefront', expect.anything());
  });
});

function employeeInvitation(): Invitation {
  return new Invitation(
    Object.freeze({
      id: 'invitation:employee',
      kind: 'enrollment',
      target: 'storefront',
      organization: 'mall-zhudatuan',
      membership: 'membership:employee',
      principal: null,
      recipientHash: Buffer.alloc(32, 2),
      keyVersion: 'current',
      issuer: 'membership:issuer',
      issuerAccessVersion: 1,
      grantDigest: 'a'.repeat(64),
      assurance: 2,
      maxUses: 1,
      useCount: 0,
      notBefore: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
      status: 'active',
      policy: 'registration:one',
      termsHash: 'b'.repeat(64),
      reason: 'employee registration',
      version: 1,
    })
  );
}

function request() {
  return {
    type: 'identity.enrollments.complete',
    security: {
      kind: 'preauth',
      id: 'preauth:employee',
      purpose: 'enrollment',
      target: 'storefront',
      principal: 'principal:employee',
      reference: 'claim:employee',
      version: 0,
      expires: new Date(Date.now() + 60_000),
      trace: 'trace:employee',
    },
    input: {
      path: { id: 'claim:employee' },
      query: {},
      headers: { 'x-device-id': 'browser', 'x-peer-address': 'local', 'user-agent': 'test' },
      body: {},
      rawBody: '',
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
      idempotency: 'complete-employee',
    },
  } as never;
}

function prepared() {
  return Object.freeze({
    invitation: 'invitation:employee',
    scope: 'mall-zhudatuan',
    body: {
      mode: 'bound' as const,
      challenge: 'challenge:employee',
      code: '123456',
      password: 'Password1!',
      termsAccepted: true as const,
      termsHash: 'b'.repeat(64),
      authorization: { state: 's', nonce: 'n', challenge: 'c' },
    },
    subject: '+8613800000000',
    password: 'password-hash',
    mobile: { ciphertext: 'ciphertext', keyVersion: 'v1', fingerprint: 'f'.repeat(64) },
    principal: 'principal:employee',
    mode: 'bound' as const,
    display: '验收员工',
    authorization: {} as never,
    returnTarget: 'root-return-proof',
  });
}

function result() {
  return { rows: [], rowCount: 0 } as never;
}
