import { createHmac } from 'node:crypto';
import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { KMS_CLIENT, type KmsClient } from '../../foundation/infrastructure/KmsClient';
import { SECURITY_KEYS } from '../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../foundation/persistence/Pool';
import { RISK_GATE } from '../../foundation/security/RiskGate';
import { WECHAT_IDENTITY } from './application/port/WechatIdentity';
import { identityOperations } from './IdentityOperations';
import { RETURN_TARGETS } from './infrastructure/ReturnTargetCatalog';

const IDENTITY_KEY = 'identity-key';
const SUBJECT = '+8613800138000';

describe('canonical member registration security boundary', () => {
  it('binds a registration challenge to both the registration purpose and the normalized subject digest', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false });
    const result = await identityOperations(context(harness.pool)).invoke(registrationRequest('registration:challenge-binding'));

    expect(result).toEqual({ status: 400, body: { code: 'CHALLENGE_INVALID' } });
    const challenge = harness.queries.find(({ text }) => text.includes('update identity.challenge set consumed_at'));
    expect(challenge).toBeDefined();
    expect(challenge?.text).toContain('purpose=$4');
    expect(challenge?.text).toContain('destination_hash=$5');
    expect(challenge?.values.slice(2)).toEqual([null, 'registration', subjectDigest(SUBJECT)]);
    expect(harness.queries.some(({ text }) => text.includes('update member.invite set use_count'))).toBe(false);
  });

  it('returns 409 for an existing subject before consuming either challenge or invitation', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: true });
    const result = await identityOperations(context(harness.pool)).invoke(registrationRequest('registration:duplicate-subject'));

    expect(result).toEqual({ status: 409, body: { code: 'IDENTITY_SUBJECT_EXISTS' } });
    expect(harness.queries.some(({ text }) => text.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(harness.queries.some(({ text }) => text.includes('update identity.challenge set consumed_at'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('update member.invite set use_count'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.principal'))).toBe(false);
  });

  it('returns 409 when an invited mobile is already bound to an account-name identity', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false,
      boundMobilePrincipal: 'principal:owner-mobile' });

    const result = await identityOperations(context(harness.pool)).invoke(registrationRequest('registration:bound-mobile'));

    expect(result).toEqual({ status: 409, body: { code: 'IDENTITY_SUBJECT_EXISTS' } });
    expect(harness.queries.some(({ text }) => text.includes('update identity.challenge set consumed_at'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('update member.invite set use_count'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.principal'))).toBe(false);
  });

  it('self-registers an L6 membership in the selected storefront without consuming an invitation', async () => {
    const harness = registrationHarness({
      challengeAccepted: true,
      subjectExists: false,
      storefrontAvailable: true,
    });

    const response = await identityRegistrationOperations(context(harness.pool))
      .invoke(storefrontRegistrationRequest('registration:storefront-self'));

    expect(response).toMatchObject({
      status: 201,
      body: {
        organization_id: 'mall:l1-hongtai',
        client: 'storefront',
        authentication: { target: 'storefront' },
      },
    });
    expect(harness.queries.some(({ text }) => text.includes('update member.invite set use_count'))).toBe(false);
    const registrationMall = harness.queries.find(({ text }) => text.includes("set_config('app.registration_mall_id'"));
    expect(registrationMall?.values).toEqual(['mall:l1-hongtai']);
    const membership = harness.queries.find(({ text }) => text.includes('insert into access.membership(')
      && text.includes("'storefront'"));
    expect(membership?.values).toContain('mall:l1-hongtai');
    const roles = harness.queries.find(({ text }) => text.includes('insert into access.membershiprole'));
    expect(roles?.values).toContain('role-zhudatuan-storefront-member:mall:l1-hongtai');
  });

  it('creates an L6 password account and defers phone verification until checkout', async () => {
    const harness = registrationHarness({
      challengeAccepted: false,
      subjectExists: false,
      storefrontAvailable: true,
    });

    const response = await identityRegistrationOperations(context(harness.pool))
      .invoke(storefrontPasswordRegistrationRequest('registration:storefront-password'));

    expect(response).toMatchObject({
      status: 201,
      body: { organization_id: 'mall:l1-hongtai', client: 'storefront', authentication: { target: 'storefront' } },
    });
    expect(harness.queries.some(({ text }) => text.includes('update identity.challenge set consumed_at'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes("'phone_otp',2"))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes("set_config('app.registration_phone_verification','checkout',true)"))).toBe(true);
    const session = harness.queries.find(({ text }) => text.includes('insert into identity.session'));
    expect(session?.values.at(-1)).toBe(1);
  });

  it('reuses one phone identity while creating an independent membership in another storefront', async () => {
    const harness = registrationHarness({
      challengeAccepted: true,
      subjectExists: false,
      boundMobilePrincipal: 'principal:existing-phone',
      storefrontAvailable: true,
    });

    const response = await identityRegistrationOperations(context(harness.pool))
      .invoke(storefrontRegistrationRequest('registration:second-storefront'));

    expect(response).toMatchObject({
      status: 201,
      body: { member_id: 'member:existing-phone', organization_id: 'mall:l1-hongtai', client: 'storefront' },
    });
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.principal'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.credential'))).toBe(false);
    const membership = harness.queries.find(({ text }) => text.includes('insert into access.membership(')
      && text.includes("'storefront'"));
    expect(membership?.values).toContain('member:existing-phone');
    expect(membership?.values).toContain('mall:l1-hongtai');
  });

  it('reuses an existing phone identity, creates the invited storefront membership, and opens its session', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false, inviteAccepted: true,
      boundMobilePrincipal: 'principal:existing-phone' });

    const response = await identityOperations(context(harness.pool))
      .invoke(registrationRequest('registration:existing-direct-login', true));

    expect(response).toMatchObject({
      status: 201,
      body: {
        member_id: 'member:existing-phone',
        organization_id: 'mall-zhudatuan',
        client: 'storefront',
        status: 'active',
        authentication: {
          membership: expect.stringMatching(/^membership:/),
          target: 'storefront',
          callback: { ticket: expect.any(String), state: 's'.repeat(32) },
        },
      },
      headers: {
        'set-cookie': expect.stringContaining('shop_session='),
        'x-set-cookie': expect.stringContaining('shop_csrf='),
      },
    });
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.principal'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.credential'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('insert into member.profile'))).toBe(false);
    const existingMembership = harness.queries.find(({ text }) => text.includes('select * from access.membership')
      && text.includes("client='storefront'"));
    expect(existingMembership?.text).toBeDefined();
    expect(existingMembership?.text).not.toContain('for update');
    const membership = harness.queries.find(({ text }) => text.includes('insert into access.membership(') && text.includes("'storefront'"));
    expect(membership?.values).toContain('member:existing-phone');
    const session = harness.queries.find(({ text }) => text.includes('insert into identity.session'));
    expect(session?.values).toContain('principal:existing-phone');
  });

  it('persists phone proof and binds both consumer and self roles in the registration transaction', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false, inviteAccepted: true });
    const encrypt = vi.fn(async (key: string, plaintext: string, context: Readonly<Record<string, string>>) => ({
      ciphertext: `ciphertext:${plaintext}`, fingerprint: 'a'.repeat(64), keyVersion: `${key}:v1`, context,
    }));

    const response = await identityRegistrationOperations(context(harness.pool, { encrypt } as unknown as KmsClient))
      .invoke(registrationRequest('registration:complete'));

    expect(response.status).toBe(201);
    const mobile = encrypt.mock.calls.find(([key]) => key === 'identity/mobile');
    expect(mobile?.[1]).toBe('+8613800138000');
    expect(mobile?.[2]).toEqual({ principal: expect.stringMatching(/^principal:/) });
    const profile = harness.queries.find(({ text }) => text.includes('insert into member.profile'));
    expect(profile?.text).toContain('mobile_ciphertext,mobile_token,mobile_masked');
    expect(profile?.values).toContain('ciphertext:+8613800138000');
    const roles = harness.queries.find(({ text }) => text.includes('insert into access.membershiprole'));
    expect(roles?.text).toContain("'role:self'");
    expect(roles?.values[1]).toBe('role-zhudatuan-storefront-member');
    const assurance = harness.queries.find(({ text }) => text.includes('insert into identity.assurance'));
    expect(assurance?.text).toContain("'phone_otp',2");
    expect(assurance?.values[2]).toBe(subjectDigest(SUBJECT));
  });

  it('turns an operator invitation into separate storefront and pending-operator memberships', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false, inviteAccepted: true, operatorInvite: true });

    const response = await identityRegistrationOperations(context(harness.pool))
      .invoke(registrationRequest('registration:operator-complete'));

    expect(response).toMatchObject({ status: 201, body: { client: 'operator', governanceLevel: 'administrator' } });
    const memberships = harness.queries.filter(({ text }) => text.includes('insert into access.membership('));
    expect(memberships).toHaveLength(2);
    expect(memberships[0]?.text).toContain("'storefront'");
    expect(memberships[0]?.values).toContain('mall-zhudatuan');
    expect(memberships[1]?.text).toContain("'operator'");
    expect(memberships[1]?.values).toContain('tenant-zhudatuan');
    const invitationConsumption = harness.queries.find(({ text }) => text.includes('with candidate as materialized')
      && text.includes('update member.invite'));
    expect(invitationConsumption?.text).toContain("accepted_membership_id=case when candidate.target_client='operator' then $3");
    expect(memberships[1]?.values).toContain(invitationConsumption?.values[2]);
    const roles = harness.queries.filter(({ text }) => text.includes('insert into access.membershiprole'));
    expect(roles[0]?.values).toContain('role-zhudatuan-storefront-member');
    expect(roles[1]?.values).toContain('role-zhudatuan-pending-operator');
  });

  it('turns a senior invitation into a tenant-scoped senior operator without creating Owner state', async () => {
    const harness = registrationHarness({
      challengeAccepted: true, subjectExists: false, inviteAccepted: true, operatorInvite: true, seniorInvite: true,
    });

    const response = await identityRegistrationOperations(context(harness.pool))
      .invoke(registrationRequest('registration:senior-complete'));

    expect(response).toMatchObject({ status: 201, body: { client: 'operator', governanceLevel: 'senior_administrator' } });
    const roles = harness.queries.filter(({ text }) => text.includes('insert into access.membershiprole'));
    expect(roles[1]?.values).toContain('role-senior-administrator-v1:tenant-zhudatuan');
    expect(harness.queries.some(({ text }) => text.includes('insert into access.platformowner'))).toBe(false);
    const operatorScopes = harness.queries.find(({ text, values }) => text.includes('insert into access.scopegrant')
      && values.includes('tenant-zhudatuan'));
    expect(operatorScopes?.text).toContain("'tenant'");
  });
});

function registrationRequest(idempotency: string): OperationRequest {
  return {
    type: 'identity.members.create',
    access: null,
    input: {
      path: {},
      query: {},
      headers: { 'x-device-id': 'device:registration-test' },
      body: {
        subject: SUBJECT,
        password: 'Registration!Password1',
        displayName: '测试会员',
        challenge: 'challenge:registration',
        code: '123456',
        invite: 'INVITE-CODE',
        termsAccepted: true,
        termsHash: 'f'.repeat(64),
      },
      rawBody: '',
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
      idempotency,
    },
  };
}

function storefrontRegistrationRequest(idempotency: string): OperationRequest {
  return {
    type: 'identity.members.create',
    access: null,
    input: {
      path: {},
      query: {},
      headers: { 'x-device-id': 'device:storefront-registration-test' },
      body: {
        subject: SUBJECT,
        password: 'Automatic!Password1',
        displayName: 'L6消费者8000',
        challenge: 'challenge:registration',
        code: '123456',
        application: 'zdt-l1-verify',
        termsAccepted: true,
        termsHash: 'f'.repeat(64),
        authorization: authorizationRequest(),
      },
      rawBody: '',
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
      idempotency,
    },
  };
}

function storefrontPasswordRegistrationRequest(idempotency: string): OperationRequest {
  return {
    input: {
      path: {},
      query: {},
      headers: { 'x-device-id': 'device:storefront-registration-test' },
      body: {
        subject: SUBJECT,
        password: 'Automatic!Password1',
        displayName: 'L6消费者8000',
        application: 'zdt-l1-verify',
        termsAccepted: true,
        termsHash: 'f'.repeat(64),
        authorization: authorizationRequest(),
        phoneVerification: 'checkout',
      },
      rawBody: '',
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
      idempotency,
    },
    type: 'identity.members.create',
    access: null,
  };
}

function storefrontContextRequest(): OperationRequest {
  return {
    type: 'identity.storefronts.read',
    access: null,
    input: {
      path: {}, query: {}, headers: { 'x-device-id': 'device:storefront-context-test' },
      body: { application: 'zdt-l1-verify' }, rawBody: '', deadline: Date.now() + 5_000,
      signal: new AbortController().signal, idempotency: 'registration:storefront-context',
    },
  };
}

function challengeRequest(body: Readonly<Record<string, unknown>>): OperationRequest {
  return {
    type: 'identity.challenges.create',
    access: null,
    input: {
      path: {},
      query: {},
      headers: { 'x-device-id': 'device:registration-test' },
      body,
      rawBody: '',
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
      idempotency: 'registration:challenge-purpose',
    },
  };
}

function passwordLoginRequest(subject: string, password: string): OperationRequest {
  return {
    type: 'identity.sessions.create',
    access: null,
    input: {
      path: {}, query: {}, headers: { 'x-device-id': 'device:password-login-test' },
      body: { provider: 'password', subject, password, target: 'console', authorization: authorizationRequest() },
      rawBody: '', deadline: Date.now() + 5_000, signal: new AbortController().signal,
      idempotency: 'password:mobile-login',
    },
  };
}

function authorizationRequest(): Readonly<Record<string, string>> {
  return {
    state: 's'.repeat(32), nonce: 'n'.repeat(32), challenge: 'c'.repeat(43),
    returnTarget: 'https://console.example.test/auth/callback',
  };
}

function stepupRequest(body: Readonly<Record<string, unknown>>): OperationRequest {
  return {
    type: 'identity.stepup.start',
    access: {
      actor: { id: 'principal:stepup', session: 'session:stepup', membership: 'membership:stepup', credentialVersion: 1,
        accessVersion: 1, target: 'console', assurance: { level: 2 } },
      membership: { id: 'membership:stepup', active: true, accessVersion: 1, denies: [], grants: [] },
      scope: { id: 'tenant-zhudatuan', kind: 'tenant', tenant: 'tenant-zhudatuan', path: [] },
      accessVersion: 1, capabilities: ['identity.stepup.start'], assurance: { level: 2 }, trace: 'trace:stepup',
    },
    input: {
      path: {}, query: {}, headers: { 'x-device-id': 'device:stepup-test' }, body, rawBody: JSON.stringify(body),
      deadline: Date.now() + 5_000, signal: new AbortController().signal, idempotency: 'stepup:start',
    },
  };
}

function mobileChallengeRequest(body: Readonly<Record<string, unknown>>): OperationRequest {
  return authenticatedRequest('identity.mobile.challenge', body, 'mobile:challenge');
}

function mobileManageRequest(isExactOwner = false): OperationRequest {
  return authenticatedRequest('identity.mobile.manage', {
    mobile: SUBJECT, challenge: 'challenge:phone-change', code: '123456',
  }, 'mobile:manage', isExactOwner);
}

function stepupCompleteRequest(): OperationRequest {
  return authenticatedRequest('identity.stepup.complete', {
    challenge: 'challenge:stepup', code: '123456',
  }, 'stepup:complete');
}

function passwordResetRequest(): OperationRequest {
  return {
    type: 'identity.password.reset', access: null,
    input: {
      path: {}, query: {}, headers: { 'x-device-id': 'device:password-reset' },
      body: { challenge: 'challenge:password-reset', code: '123456', newPassword: 'Replacement!Password2' },
      rawBody: '', deadline: Date.now() + 5_000, signal: new AbortController().signal,
      idempotency: 'password:reset',
    },
  };
}

function authenticatedRequest(type: OperationRequest['type'], body: Readonly<Record<string, unknown>>,
  idempotency: string, isExactOwner = false): OperationRequest {
  return {
    type,
    access: {
      actor: { id: 'principal:stepup', session: 'session:stepup', membership: 'membership:stepup', credentialVersion: 1,
        accessVersion: 1, target: 'console', assurance: { level: 2 } },
      membership: { id: 'membership:stepup', active: true, accessVersion: 1, denies: [], grants: [] },
      scope: { id: 'principal:stepup', kind: 'self', path: [] }, accessVersion: 1,
      governance: { governanceLevel: isExactOwner ? 'owner' : 'administrator', isExactOwner,
        actorMembershipId: 'membership:stepup', actorPrincipalId: 'principal:stepup', organizationId: 'tenant-zhudatuan',
        ownerMembershipId: isExactOwner ? 'membership:stepup' : 'membership:owner',
        scope: { kind: 'self', semanticId: 'principal:stepup', storageId: 'self:principal:stepup' },
        resolvedAt: new Date('2026-09-02T00:00:00.000Z') },
      capabilities: [type], assurance: { level: 2 }, trace: `trace:${idempotency}`,
    },
    input: {
      path: {}, query: {}, headers: { 'x-device-id': `device:${idempotency}` }, body, rawBody: JSON.stringify(body),
      deadline: Date.now() + 5_000, signal: new AbortController().signal, idempotency,
    },
  };
}

function registrationHarness(input: Readonly<{ challengeAccepted: boolean; subjectExists: boolean; inviteAccepted?: boolean; operatorInvite?: boolean;
  seniorInvite?: boolean;
  storefrontAvailable?: boolean;
  mobileCiphertext?: string | null; passwordEvidence?: boolean; exactOwner?: boolean;
  challengePrincipal?: string | null; boundMobilePrincipal?: string | null;
  credentialSecret?: string; ownerPasswordRotation?: boolean; loginMemberships?: boolean; existingMembership?: boolean }>): Readonly<{
  pool: DatabasePool;
  queries: ReadonlyArray<Readonly<{ text: string; values: readonly unknown[] }>>;
}> {
  let requestHash = '';
  const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
  const client = {
    query: async (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values });
      if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
      if (text.startsWith('select request_hash,state,response')) {
        return result([{ request_hash: requestHash, state: 'started', response: null }]);
      }
      if (text.includes("select 1 from identity.credential") && text.includes("provider='password'")) {
        return result(input.subjectExists ? [{ exists: 1 }] : []);
      }
      if (text.includes('update identity.challenge set consumed_at')) {
        return result(input.challengeAccepted ? [{ principal_id: null }] : []);
      }
      return result([]);
    },
    release: () => undefined,
  } as unknown as PoolClient;
  const pool: DatabasePool = {
    connect: async () => client,
    query: async () => result([]),
    workload: () => pool,
    end: async () => undefined,
  };
  return { pool, queries };
}

function context(pool: DatabasePool): ModuleContext {
  const container = new Container();
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
  container.bind(SECURITY_KEYS, { identity: IDENTITY_KEY, quote: 'quote-key', session: 'session-key' });
  container.bind(KMS_CLIENT, {} as KmsClient);
  container.bind(RISK_GATE, { evaluate: async () => ({ outcome: 'allow', safeReason: 'policy', decision: null }) });
  container.bind(WECHAT_IDENTITY, {
    application: () => ({ applicationHash: 'application' }),
    authorize: () => 'https://example.test',
    exchange: async () => ({ subject: 'subject' }),
  });
  container.bind(RETURN_TARGETS, {
    console: 'https://console.example.test',
    storefront: 'https://storefront.example.test',
    store: 'https://store.example.test',
    supplier: 'https://supplier.example.test',
  });
  return { container } as unknown as ModuleContext;
}

function subjectDigest(subject: string): string {
  return createHmac('sha256', IDENTITY_KEY).update(subject.trim().toLowerCase()).digest('hex');
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
