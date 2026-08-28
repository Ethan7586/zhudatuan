import { createHmac } from 'node:crypto';
import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { KMS_CLIENT, type KmsClient } from '../../foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS } from '../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../foundation/persistence/Pool';
import { RISK_GATE } from '../../foundation/security/RiskGate';
import { WECHAT_IDENTITY } from './application/port/WechatIdentity';
import { identityOperations, identityRegistrationOperations } from './IdentityOperations';
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
    expect(challenge?.values[1]).toBe(challengeCodeDigest('challenge:registration', `123456:${subjectDigest('INVITE-CODE')}`));
    expect(harness.queries.some(({ text }) => text.includes('update member.invite set use_count'))).toBe(false);
  });

  it('allows only registration challenges on the registration-only API surface', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false });

    await expect(identityRegistrationOperations(context(harness.pool)).invoke(challengeRequest({
      destination: SUBJECT,
      purpose: 'password_reset',
      invite: 'INVITE-CODE',
    }))).rejects.toMatchObject({
      result: { status: 400, body: { code: 'CHALLENGE_PURPOSE_INVALID' } },
    });
    expect(harness.queries).toHaveLength(0);
  });

  it('rejects an invalid invitation before creating a challenge or queuing an SMS job', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false });
    const kms = {
      encrypt: async () => ({ ciphertext: 'encrypted-challenge-value', fingerprint: 'f'.repeat(64), keyVersion: 'v1' }),
    } as unknown as KmsClient;

    const result = await identityRegistrationOperations(context(harness.pool, kms)).invoke(challengeRequest({
      destination: SUBJECT,
      purpose: 'registration',
      invite: 'INVALID-INVITE',
    }));

    expect(result).toEqual({ status: 400, body: { code: 'INVITE_INVALID' } });
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.challenge'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('insert into runtime.job'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('select invite.id from member.invite'))).toBe(true);
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

function registrationHarness(input: Readonly<{ challengeAccepted: boolean; subjectExists: boolean; inviteAccepted?: boolean }>): Readonly<{
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
      if (text.includes('with candidate as materialized') && text.includes('update member.invite')) {
        return result(input.inviteAccepted ? [{ organization_id: 'mall-zhudatuan', role_id: 'role-zhudatuan-storefront-member', terms_hash: 'f'.repeat(64) }] : []);
      }
      if (text.includes('select kind from organization.organization')) return result([{ kind: 'mall' }]);
      if (text.includes('insert into access.membership') && text.includes('returning *')) return result([{ id: String(values[0]), client: 'storefront' }]);
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

function context(pool: DatabasePool, kms: KmsClient = {
  encrypt: async () => ({ ciphertext: 'encrypted-value', fingerprint: 'f'.repeat(64), keyVersion: 'v1' }),
} as unknown as KmsClient): ModuleContext {
  const container = new Container();
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
  container.bind(IDENTITY_SECURITY_KEYS, { identity: IDENTITY_KEY, session: 'session-key' });
  container.bind(KMS_CLIENT, kms);
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

function challengeCodeDigest(challenge: string, code: string): string {
  return createHmac('sha256', 'session-key').update(`${challenge}:${code}`).digest('hex');
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
