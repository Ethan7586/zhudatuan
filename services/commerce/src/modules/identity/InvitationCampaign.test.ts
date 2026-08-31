import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { DelegationPolicy } from '../access/domain/policy/DelegationPolicy';
import { Invitation } from './domain/model/Invitation';
import { InvitationPolicy } from './domain/policy/InvitationPolicy';
import { PgInvitationRepository } from './infrastructure/persistence/PgInvitationRepository';
import { PgLinkCaseRepository } from './infrastructure/persistence/PgLinkCaseRepository';
import { CompleteEnrollment } from './application/command/CompleteEnrollment';
import { InvitationRedeemer } from './application/service/InvitationRedeemer';
import { SessionCookieAdapter } from './infrastructure/security/SessionCookie';
import { EnrollmentService } from './application/service/EnrollmentService';
import { registrationPolicyView } from './application/query/RegistrationPolicyView';

describe('campaign enrollment invitation', () => {
  it('exposes only the public registration policy contract', () => {
    expect(
      registrationPolicyView({
        id: 'registration:internal',
        terms_title: '服务协议',
        terms_body: '协议正文',
        privacy_title: '隐私政策',
        privacy_body: '隐私正文',
        terms_hash: 'a'.repeat(64),
      })
    ).toEqual({
      terms_title: '服务协议',
      terms_body: '协议正文',
      privacy_title: '隐私政策',
      privacy_body: '隐私正文',
      terms_hash: 'a'.repeat(64),
    });
  });

  it('is enrollment-only and accepts the fixed minimum system grant without permitting owner grants', () => {
    const invitation = campaign();
    expect(invitation.requiresEnrollment()).toBe(true);
    expect(invitation.requiresProof()).toBe(false);
    const issue = { kind: 'campaign', target: 'storefront', membership: null, principal: null, recipientHash: null, maxUses: 100, assurance: 1, reason: 'employee campaign', expiresAt: new Date(Date.now() + 86_400_000) } as const;
    expect(() => new InvitationPolicy().issue(issue, new Date('2026-08-30T00:00:00.000Z'))).not.toThrow();
    const permissions = new Set(['access.role.delegate', 'access.scope.delegate', 'cart.read']);
    expect(() => new DelegationPolicy().assertCampaign({ roleKinds: ['system'], issuerPermissions: permissions, issuerDenies: new Set(), targetPermissions: ['cart.read'], scopeAllowed: true })).not.toThrow();
    expect(() => new DelegationPolicy().assertCampaign({ roleKinds: ['owner'], issuerPermissions: permissions, issuerDenies: new Set(), targetPermissions: ['cart.read'], scopeAllowed: true })).toThrow('DELEGATION_DENIED');
    expect(() => new DelegationPolicy().assertCampaign({ roleKinds: ['system'], issuerPermissions: new Set(['cart.read']), issuerDenies: new Set(), targetPermissions: ['cart.read'], scopeAllowed: true })).toThrow('DELEGATION_DENIED');
  });

  it('reserves independent campaign claims only while remaining capacity exists and creates enrollment preauth without a membership', async () => {
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const database: OperationDatabase = {
      query: async (text: string, values: readonly unknown[] = []) => {
        queries.push({ text, values });
        if (text.includes('returning id::text,invitation_id,kind,target'))
          return result([
            {
              id: '11111111-1111-4111-8111-111111111111',
              invitation_id: 'invitation:campaign',
              kind: 'campaign',
              target: 'storefront',
              recipient_hash: Buffer.alloc(32, 2),
              state: 'proofpending',
              proof_method: 'otp',
              expires_at: new Date('2026-08-30T01:05:00Z'),
              proved_at: null,
              version: 1,
            },
          ]);
        return result([]);
      },
    };
    const claim = await new PgInvitationRepository({ now: () => new Date('2026-08-30T01:00:00Z') }).reserve(database, campaign(), {
      claim: '11111111-1111-4111-8111-111111111111',
      preauth: Buffer.alloc(32, 1),
      browser: Buffer.alloc(32, 2),
      device: Buffer.alloc(32, 3),
      recipient: Buffer.alloc(32, 2),
      principal: null,
      proof: 'otp',
    });
    const reserve = queries[1]!;
    const preauth = queries[2]!;
    const outbox = queries[3]!;
    expect(claim).toMatchObject({ kind: 'campaign', state: 'proofpending', version: 1 });
    expect(reserve.text).toContain('invitation.use_count+(select count(*)');
    expect(reserve.text).toContain('<invitation.max_uses');
    expect(preauth.text).toContain("null,'[]'::jsonb");
    expect(preauth.values[4]).toBe('enrollment');
    expect(outbox.text).toContain("jsonb_build_object('invitationId',$2::text,'target',$4::text,'kind',$5::text)");
  });

  it('persists repeated subject conflicts as one open enrollment link case with monotonic versions', async () => {
    let sql = '';
    const database: OperationDatabase = {
      query: async (text: string, values: readonly unknown[] = []) => {
        sql = text;
        return result([
          {
            id: values[0],
            reason: 'subjectconflict',
            status: 'open',
            decision_by: null,
            checked_by: null,
            version: 1,
          },
        ]);
      },
    };
    const link = await new PgLinkCaseRepository().enrollment(database, 'mall-zhudatuan', 'claim:one', Buffer.alloc(32, 4), 'principal:existing');
    expect(link).toMatchObject({ reason: 'subjectconflict', status: 'open', version: 1 });
    expect(sql).toContain("values($1,null,null,null,$2,$3,'enrollment'");
    expect(sql).toContain("where source='enrollment' and status='open'");
    expect(sql).toContain('version=identity.linkcase.version+1');
  });

  it('consumes campaign capacity and activates enrollment without directly issuing a session', async () => {
    const invitation = campaign();
    let consumedSession: string | null | undefined;
    const sessions = { issue: vi.fn() };
    const repository = {
      claimed: async () => invitation,
      claim: async () => ({
        id: 'claim:one',
        invitation: invitation.state.id,
        kind: 'campaign',
        target: 'storefront',
        recipientHash: Buffer.alloc(32, 5),
        state: 'proofpending',
        proof: 'otp',
        expiresAt: new Date(Date.now() + 60_000),
        provedAt: null,
        version: 1,
      }),
      consume: async (_database: unknown, _invitation: unknown, input: { session: string | null }) => {
        consumedSession = input.session;
        return {};
      },
      consumeClaim: vi.fn(),
    };
    const access = { validateCampaign: vi.fn(), createCampaign: vi.fn(async () => ({ activationDigest: 'c'.repeat(64) })), activate: vi.fn() };
    const members = { mobileOwner: async () => null, createPending: vi.fn(), activate: vi.fn() };
    const hasher = { matchesRecipient: () => true };
    const challenges = { consume: vi.fn() };
    const count = vi.fn();
    const telemetry = { metrics: { count, duration: vi.fn() } } as never;
    const redeemer = new InvitationRedeemer(repository as never, access as never, telemetry);
    const cookies = new SessionCookieAdapter();
    const enrollments = { findPrincipal: async () => null, createPrincipal: vi.fn(), activatePrincipal: vi.fn(), createPassword: vi.fn() };
    const assurances = { record: vi.fn() };
    const events = { publish: vi.fn() };
    const enrollment = new EnrollmentService(
      repository as never,
      access as never,
      members as never,
      sessions as never,
      {} as never,
      hasher as never,
      'identity-key-value-at-least-thirty-two-bytes',
      'session-key-value-at-least-thirty-two-bytes',
      { issue: vi.fn() } as never,
      challenges as never,
      {} as never,
      redeemer,
      cookies,
      telemetry,
      enrollments as never,
      assurances as never,
      events as never,
      { record: vi.fn(), reject: vi.fn() } as never
    );
    const command = new CompleteEnrollment({} as never, enrollment);
    const request = {
      type: 'identity.enrollments.complete',
      security: { kind: 'preauth', id: 'preauth:one', purpose: 'enrollment', target: 'storefront', principal: null, reference: 'claim:one', version: 0, expires: new Date(Date.now() + 60_000), trace: 'trace:campaign' },
      input: { path: { id: 'claim:one' }, query: {}, headers: {}, body: {}, rawBody: '', deadline: Date.now() + 1000, signal: new AbortController().signal, idempotency: 'campaign-complete' },
    } as const;
    const database: OperationDatabase = { query: async () => result([]) };
    const reply = await command.lifecycle().execute(request as never, database, {
      body: {
        subject: '+85291234567',
        password: 'Password1!',
        challenge: 'challenge:one',
        code: '123456',
        termsAccepted: true,
        termsHash: 'b'.repeat(64),
        displayName: 'Campaign Member',
        authorization: { state: 's', nonce: 'n', challenge: 'c' },
      },
      subject: '+85291234567',
      password: 'password-hash',
      mobile: { ciphertext: 'cipher', keyVersion: 'v1', fingerprint: 'f'.repeat(64) },
      principal: 'principal:new',
    });
    expect(reply).toMatchObject({ status: 201, body: { kind: 'enrolled', target: 'storefront' } });
    expect(consumedSession).toBeNull();
    expect(access.validateCampaign).toHaveBeenCalledWith(database, expect.objectContaining({ issuer: 'membership:issuer', grantDigest: 'a'.repeat(64), organization: 'mall-zhudatuan' }));
    expect(sessions.issue).not.toHaveBeenCalled();
    expect(access.activate).toHaveBeenCalledWith(
      database,
      expect.objectContaining({
        membership: expect.stringMatching(/^membership:/),
        principal: 'principal:new',
        grantDigest: 'c'.repeat(64),
        target: 'storefront',
      })
    );
    expect(repository.consumeClaim).toHaveBeenCalledOnce();
    expect(count).toHaveBeenCalledWith('identity_enrollment_complete_total', 1, expect.objectContaining({ result: 'success' }));
  });
});

function campaign(): Invitation {
  return new Invitation(
    Object.freeze({
      id: 'invitation:campaign',
      kind: 'campaign',
      target: 'storefront',
      organization: 'mall-zhudatuan',
      membership: null,
      principal: null,
      recipientHash: null,
      keyVersion: 'current',
      issuer: 'membership:issuer',
      issuerAccessVersion: 1,
      grantDigest: 'a'.repeat(64),
      assurance: 1,
      maxUses: 100,
      useCount: 0,
      notBefore: new Date('2026-08-30T00:00:00Z'),
      expiresAt: new Date('2026-08-31T00:00:00Z'),
      status: 'active',
      policy: 'registration:one',
      termsHash: 'b'.repeat(64),
      reason: 'employee campaign',
      version: 1,
    })
  );
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
