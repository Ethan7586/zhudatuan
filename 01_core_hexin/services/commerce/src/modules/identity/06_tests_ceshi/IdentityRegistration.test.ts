import { createHash, createHmac } from 'node:crypto';
import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { Container } from '../../../bootstrap/Container';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { NODE_MANIFEST } from '../../../bootstrap/NodeRuntime';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { KMS_CLIENT, type KmsClient } from '../../../foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS } from '../../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../../foundation/persistence/Pool';
import { RISK_GATE } from '../../../foundation/security/RiskGate';
import { WECHAT_IDENTITY } from '../01_public_gongkai/ports_jiekou/WechatIdentity';
import { identityOperations, identityRegistrationOperations } from '../05_interface_jieru/http/IdentityOperations';
import { authTarget } from '../05_interface_jieru/http/IdentitySecurity';
import { PasswordPolicy } from '../02_domain_yewu/policies_guize/PasswordPolicy';

const IDENTITY_KEY = 'identity-key';
const SUBJECT = '+8613800138000';

describe('canonical member registration security boundary', () => {
  it('routes an active operator membership to the canonical Console login target', () => {
    expect(authTarget('operator')).toBe('console');
  });

  it('rejects a caller-selected Step-Up destination before opening a database transaction', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false });

    await expect(identityOperations(context(harness.pool)).invoke(stepupRequest({ destination: '+8613900139000' })))
      .rejects.toMatchObject({ result: { status: 400, body: { code: 'STEP_UP_DESTINATION_FORBIDDEN' } } });
    expect(harness.queries).toHaveLength(0);
  });

  it('sends Step-Up only to the verified mobile stored on the active profile', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false, mobileCiphertext: 'ciphertext:verified-mobile' });
    const encrypt = vi.fn(async (key: string, plaintext: string) => ({
      ciphertext: `encrypted:${plaintext}`, fingerprint: 'a'.repeat(64), keyVersion: `${key}:v1`,
    }));
    const decrypt = vi.fn(async () => SUBJECT);

    const response = await identityOperations(context(harness.pool, { encrypt, decrypt } as unknown as KmsClient, 'node:hbbtzn:l1'))
      .invoke(stepupRequest({}));

    expect(response.status).toBe(202);
    expect(decrypt).toHaveBeenCalledWith('identity/mobile', 'ciphertext:verified-mobile', { principal: 'principal:stepup' });
    expect(encrypt.mock.calls.find(([key]) => key === 'identity/destination')?.[1]).toBe(SUBJECT);
    const challenge = harness.queries.find(({ text }) => text.includes("values($1,$2,'stepup'"));
    expect(challenge?.values[2]).toBe(subjectDigest(SUBJECT));
    const notification = harness.queries.find(({ text }) => text.includes('insert into runtime.job'));
    expect(notification?.text).toContain("'identitynotification','identity'");
    expect(notification?.text).not.toContain("'notification','identity'");
    expect(notification?.values[1]).toBe('node:hbbtzn:l1');
  });

  it('rejects public phone-change and Step-Up challenge purposes before opening a transaction', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false });

    for (const purpose of ['phone_change', 'stepup']) {
      await expect(identityOperations(context(harness.pool)).invoke(challengeRequest({
        destination: SUBJECT, principal: 'principal:attacker-selected', purpose,
      }))).rejects.toThrow('CHALLENGE_PURPOSE_INVALID');
    }
    expect(harness.queries).toHaveLength(0);
  });

  it('binds a mobile challenge to the authenticated actor instead of caller input', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false });
    const response = await identityOperations(context(harness.pool)).invoke(mobileChallengeRequest({
      destination: SUBJECT, principal: 'principal:attacker-selected', purpose: 'stepup',
    }));

    expect(response.status).toBe(202);
    const challenge = harness.queries.find(({ text }) => text.includes("values($1,$2,'phone_change'"));
    expect(challenge?.values[1]).toBe('principal:stepup');
    expect(challenge?.values[2]).toBe(subjectDigest(SUBJECT));
    expect(challenge?.values[4]).toBe(sessionEvidenceDigest('session:stepup'));
  });

  it('stores password verification with the session digest required by first mobile enrollment', async () => {
    const credentialSecret = await new PasswordPolicy().hash('Current!Password1');
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false, credentialSecret });

    const response = await identityOperations(context(harness.pool)).invoke(authenticatedRequest(
      'identity.password.verify', { password: 'Current!Password1' }, 'password:verify'
    ));

    expect(response.status).toBe(200);
    const evidence = harness.queries.find(({ text }) => text.includes("$3,'password',2,$4"));
    expect(evidence?.values[3]).toBe(sessionEvidenceDigest('session:stepup'));
  });

  it('requires fresh password proof before the first mobile enrollment', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false, mobileCiphertext: null });

    await expect(identityOperations(context(harness.pool)).invoke(mobileManageRequest()))
      .resolves.toEqual({ status: 403, body: { code: 'MOBILE_ENROLLMENT_PASSWORD_REQUIRED' } });
    expect(harness.queries.some(({ text }) => text.includes('update identity.challenge set consumed_at'))).toBe(false);
  });

  it('requires fresh Level-3 assurance before replacing an existing mobile', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false,
      mobileCiphertext: 'ciphertext:existing-mobile', passwordEvidence: true });

    await expect(identityOperations(context(harness.pool)).invoke(mobileManageRequest()))
      .resolves.toEqual({ status: 403, body: { code: 'MOBILE_CHANGE_STEP_UP_REQUIRED' } });
    expect(harness.queries.some(({ text }) => text.includes('update identity.challenge set consumed_at'))).toBe(false);
  });

  it('rejects a mobile already owned by another principal before consuming the change challenge', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false,
      boundMobilePrincipal: 'principal:other-mobile-owner', mobileCiphertext: null, passwordEvidence: true });

    await expect(identityOperations(context(harness.pool)).invoke(mobileManageRequest()))
      .resolves.toEqual({ status: 409, body: { code: 'IDENTITY_SUBJECT_EXISTS' } });
    expect(harness.queries.some(({ text }) => text.includes('update identity.challenge set consumed_at'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('update member.profile set mobile_ciphertext'))).toBe(false);
  });

  it('updates the login subject and revokes every session after password-proven first mobile enrollment', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false,
      mobileCiphertext: null, passwordEvidence: true });

    const response = await identityOperations(context(harness.pool)).invoke(mobileManageRequest());

    expect(response.status).toBe(200);
    const revocation = harness.queries.find(({ text }) => text.includes("revoked_reason='mobile_changed'"));
    expect(revocation?.text).not.toContain('id<>');
    expect(revocation?.values).toEqual(['account:stepup:l0', 'realm:l0']);
    const credential = harness.queries.find(({ text }) => text.includes('update identity.credential set subject_hash'));
    expect(credential?.text).toContain("provider='password' and status='active'");
    expect(credential?.values).toContain(subjectDigest(SUBJECT));
  });

  it('delegates the dynamic Owner under a resolved self scope to the atomic database boundary', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false,
      mobileCiphertext: null, passwordEvidence: true, exactOwner: true });

    const response = await identityOperations(context(harness.pool)).invoke(mobileManageRequest(true));

    expect(response.status).toBe(200);
    expect(harness.queries.some(({ text }) => text.includes('from access.platformowner owner'))).toBe(false);
    const boundary = harness.queries.find(({ text }) => text.includes('access.change_zhudatuan_owner_mobile'));
    expect(boundary?.values.slice(0, 3)).toEqual(['principal:stepup', 'session:stepup', 'challenge:phone-change']);
    expect(boundary?.values.slice(4)).toEqual([
      subjectDigest(SUBJECT), 'f'.repeat(64), '+86****8000',
      sessionEvidenceDigest('session:stepup'), sessionEvidenceDigest('session:stepup'),
    ]);
    expect(harness.queries.some(({ text }) => text.includes('select id from identity.credential'))).toBe(false);
    expect(harness.queries.findIndex(({ text }) => text.includes('platform-owner-transfer:v1')))
      .toBeLessThan(harness.queries.findIndex(({ text }) => text.includes('select mobile_ciphertext from identity.account')));
  });

  it('binds Step-Up completion to the verified profile mobile', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false,
      mobileCiphertext: 'ciphertext:verified-mobile' });
    const decrypt = vi.fn(async () => SUBJECT);

    const result = await identityOperations(context(harness.pool, { decrypt } as unknown as KmsClient))
      .invoke(stepupCompleteRequest());

    expect(result).toEqual({ status: 400, body: { code: 'CHALLENGE_INVALID' } });
    const challenge = harness.queries.find(({ text }) => text.includes('update identity.challenge set consumed_at'));
    expect(challenge?.text).toContain('destination_hash=$5');
    expect(challenge?.text).toContain('session_hash=$6');
    expect(challenge?.values.slice(2)).toEqual([
      'principal:stepup', 'stepup', subjectDigest(SUBJECT), sessionEvidenceDigest('session:stepup'),
      'realm:l0', 'account:stepup:l0',
    ]);
  });

  it('binds successful Level-3 assurance to the current session', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false,
      mobileCiphertext: 'ciphertext:verified-mobile' });
    const decrypt = vi.fn(async () => SUBJECT);

    const response = await identityOperations(context(harness.pool, { decrypt } as unknown as KmsClient))
      .invoke(stepupCompleteRequest());

    expect(response.status).toBe(200);
    const phoneAssurance = harness.queries.find(({ text }) => text.includes("'phone_otp',2"));
    expect(phoneAssurance?.values).toEqual([
      expect.stringMatching(/^assurance:/), 'principal:stepup', subjectDigest(SUBJECT),
      'realm:l0', 'account:stepup:l0',
    ]);
    const assurance = harness.queries.find(({ text }) => text.includes("'otp',3"));
    expect(assurance?.values).toEqual([
      expect.stringMatching(/^assurance:/), 'principal:stepup', 'session:stepup', sessionEvidenceDigest('session:stepup'),
      'realm:l0', 'account:stepup:l0',
    ]);
    expect(assurance?.values[3]).not.toBe(subjectDigest('challenge:stepup'));
  });

  it('verifies the profile mobile and completes WeChat binding in one transaction', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false,
      mobileCiphertext: 'ciphertext:verified-mobile', wechatGrant: true });
    const decrypt = vi.fn(async () => SUBJECT);

    const response = await identityOperations(context(harness.pool, { decrypt } as unknown as KmsClient))
      .invoke(stepupCompleteRequest('wechat-binding-token'));

    expect(response).toMatchObject({
      status: 200,
      body: { id: 'session:stepup', assurance_level: 3,
        wechat: { identity: 'identity:wechat', status: 'active' } },
    });
    const grant = harness.queries.find(({ text }) => text.includes('from identity.wechatgrant bindinggrant'));
    expect(grant?.values).toEqual([createHash('sha256').update('wechat-binding-token').digest('hex'), 'realm:l0']);
    const grantIndex = harness.queries.findIndex(({ text }) => text.includes('from identity.wechatgrant bindinggrant'));
    const challengeIndex = harness.queries.findIndex(({ text }) => text.includes('update identity.challenge set consumed_at'));
    const bindingIndex = harness.queries.findIndex(({ text }) => text.startsWith('update identity.federatedidentity'));
    expect(grantIndex).toBeLessThan(challengeIndex);
    expect(challengeIndex).toBeLessThan(bindingIndex);
  });

  it('does not consume phone verification when the WeChat binding token is invalid', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false,
      mobileCiphertext: 'ciphertext:verified-mobile' });

    const response = await identityOperations(context(harness.pool)).invoke(stepupCompleteRequest('invalid-token'));

    expect(response).toEqual({ status: 400, body: { code: 'WECHAT_BINDING_TOKEN_INVALID' } });
    expect(harness.queries.some(({ text }) => text.includes('update identity.challenge set consumed_at'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.assurance'))).toBe(false);
  });

  it('routes current Owner password change through the atomic rotation boundary', async () => {
    const credentialSecret = await new PasswordPolicy().hash('Current!Password1');
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false,
      credentialSecret, ownerPasswordRotation: true });

    const response = await identityOperations(context(harness.pool)).invoke(authenticatedRequest(
      'identity.password.change', { currentPassword: 'Current!Password1', newPassword: 'Replacement!Password2' },
      'password:change'
    ));

    expect(response.status).toBe(200);
    const rotation = harness.queries.find(({ text }) => text.includes('identity.rotate_zhudatuan_owner_password'));
    expect(rotation?.values.slice(0, 2)).toEqual(['principal:stepup', 'session:stepup']);
    const evidence = harness.queries.find(({ text }) => text.includes("'password',2"));
    expect(evidence?.values[2]).toBe(sessionEvidenceDigest('session:stepup'));
    expect(harness.queries.some(({ text }) => text.startsWith('update identity.credential set secret_hash'))).toBe(false);
    expect(harness.queries.findIndex(({ text }) => text.includes('platform-owner-transfer:v1')))
      .toBeLessThan(harness.queries.findIndex(({ text }) => text.includes('select id,secret_hash from identity.credential')));
  });

  it('routes current Owner password reset through the consumed-challenge boundary', async () => {
    const harness = registrationHarness({ challengeAccepted: true, challengePrincipal: 'principal:stepup',
      subjectExists: false, ownerPasswordRotation: true });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(passwordResetRequest());

    expect(response.status).toBe(200);
    const rotation = harness.queries.find(({ text }) => text.includes('identity.rotate_zhudatuan_owner_password'));
    expect(rotation?.values.slice(0, 2)).toEqual(['principal:stepup', 'challenge:password-reset']);
    expect(rotation?.text).toContain('null::text');
    expect(harness.queries.some(({ text }) => text.startsWith('update identity.credential set secret_hash'))).toBe(false);
  });

  it('restores a consumed password-reset challenge when no realm account can be completed', async () => {
    const harness = registrationHarness({ challengeAccepted: true, challengePrincipal: null, subjectExists: false });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(passwordResetRequest());

    expect(response).toEqual({ status: 400, body: { code: 'CHALLENGE_PRINCIPAL_MISSING' } });
    const consumed = harness.queries.findIndex(({ text }) => text.includes('update identity.challenge set consumed_at'));
    const rollback = harness.queries.findIndex(({ text }) => text === 'rollback to savepoint identity_business_mutation');
    expect(consumed).toBeGreaterThanOrEqual(0);
    expect(rollback).toBeGreaterThan(consumed);
    expect(harness.queries.findIndex(({ text }) => text.startsWith('update runtime.idempotency'))).toBeGreaterThan(rollback);
  });

  it('binds a registration challenge to both the registration purpose and the normalized subject digest', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false });
    const result = await identityOperations(context(harness.pool)).invoke(registrationRequest('registration:challenge-binding'));

    expect(result).toEqual({ status: 400, body: { code: 'CHALLENGE_INVALID' } });
    const challenge = harness.queries.find(({ text }) => text.includes('update identity.challenge set consumed_at'));
    expect(challenge).toBeDefined();
    expect(challenge?.text).toContain('purpose=$4');
    expect(challenge?.text).toContain('destination_hash=$5');
    expect(challenge?.values.slice(2)).toEqual([null, 'registration', subjectDigest(SUBJECT), null, 'realm:l0', null]);
    expect(challenge?.values[1]).toBe(challengeCodeDigest('challenge:registration', `123456:${subjectDigest('INVITE-CODE')}`));
    expect(harness.queries.some(({ text }) => text.includes('update member.invite set use_count'))).toBe(false);
  });

  it('allows password reset challenges on the registration API surface', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false,
      challengePrincipal: 'principal:password-reset' });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(challengeRequest({
      destination: '13800138000',
      purpose: 'password_reset',
    }));

    expect(response.status).toBe(202);
    const challenge = harness.queries.find(({ text }) => text.includes('with challenge as'));
    expect(challenge?.values[2]).toBe('password_reset');
    expect(challenge?.values[3]).toBe(subjectDigest(SUBJECT));
  });

  it('resolves password reset through the independently bound mobile identity', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false,
      boundMobilePrincipal: 'principal:bound-mobile' });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(challengeRequest({
      destination: SUBJECT,
      purpose: 'password_reset',
    }));

    expect(response.status).toBe(202);
    const challenge = harness.queries.find(({ text }) => text.includes('with challenge as'));
    expect(challenge?.values[1]).toBe('principal:bound-mobile');
    expect(harness.queries.some(({ text }) => text.includes('select principal_id from identity.credential'))).toBe(false);
  });

  it('allows login challenges on the deployed identity registration API surface', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false,
      boundMobilePrincipal: 'principal:mobile-login' });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(challengeRequest({
      destination: SUBJECT,
      purpose: 'login',
    }));

    expect(response.status).toBe(202);
    const challenge = harness.queries.find(({ text }) => text.includes('with challenge as'));
    expect(challenge?.values.slice(1, 4)).toEqual(['principal:mobile-login', 'login', subjectDigest(SUBJECT)]);
    expect(harness.queries.some(({ text }) => text.includes("'identitynotification','identity'"))).toBe(true);
  });

  it('logs in with a bound mobile while preserving the original password credential subject', async () => {
    const password = 'Current!Password1';
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false,
      boundMobilePrincipal: 'principal:mobile-login', credentialSecret: await new PasswordPolicy().hash(password),
      loginMemberships: true });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(passwordLoginRequest(SUBJECT, password));

    expect(response).toMatchObject({
      status: 200,
      body: {
        principal: 'principal:mobile-login',
        memberships: [{ id: 'membership:console:one', client: 'console' }, { id: 'membership:console:two', client: 'console' }],
      },
    });
    const credential = harness.queries.find(({ text }) => text.includes('account.credential_version,credential.secret_hash'));
    expect(credential?.values).toEqual([
      'realm:l0', subjectDigest(SUBJECT), expect.any(Array), 'operator', 'tenant-zhudatuan',
    ]);
  });

  it.each([
    {
      name: 'L0_ADMIN', host: 'api.zhudatuan.com', target: 'console', application: undefined,
      membership: 'membership:l0:admin', responseTarget: 'console', ticketTarget: 'console',
    },
    {
      name: 'L0_CONSUMER', host: 'api.zhudatuan.com', target: 'storefront', application: 'zhudatuan-storefront',
      membership: 'membership:l0:consumer', responseTarget: 'storefront', ticketTarget: 'storefront',
    },
    {
      name: 'L1_ADMIN', host: 'api.hbbtzn.com', target: 'console', application: undefined,
      membership: 'membership:l1:admin', responseTarget: 'console', ticketTarget: 'console',
    },
    {
      name: 'L1_CONSUMER', host: 'hbbtzn.com', target: 'storefront', application: 'zdt-l1-verify',
      membership: 'membership:l1:consumer', responseTarget: 'storefront', ticketTarget: 'storefront',
    },
  ])('keeps $name inside its host-bound realm when one phone has every membership', async ({
    host, target, application, membership, responseTarget, ticketTarget,
  }) => {
    const password = 'Current!Password1';
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false, storefrontAvailable: true,
      storefrontOrganizationId: 'mall:d1708f04df2dd8a61736852c4900fb43',
      boundMobilePrincipal: 'principal:all-realms', credentialSecret: await new PasswordPolicy().hash(password),
      loginMembershipRows: [
        { id: 'membership:l0:admin', access_version: 1, client: 'operator', organization_id: 'tenant-zhudatuan' },
        { id: 'membership:l0:consumer', access_version: 1, client: 'storefront', organization_id: 'mall-zhudatuan' },
        { id: 'membership:l1:admin', access_version: 1, client: 'operator', organization_id: 'mall:d1708f04df2dd8a61736852c4900fb43' },
        { id: 'membership:l1:consumer', access_version: 1, client: 'storefront', organization_id: 'mall:d1708f04df2dd8a61736852c4900fb43' },
      ] });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(passwordLoginRequest(SUBJECT, password, {
      target, ...(application === undefined ? {} : { application }),
    }, host));

    expect(response).toMatchObject({ status: 201, body: { membership, target: responseTarget } });
    const session = harness.queries.find(({ text }) => text.includes('insert into identity.session'));
    expect(session?.values[2]).toBe(membership);
    expect(session?.values.slice(11)).toEqual([
      host.includes('hbbtzn') ? 'realm:l1' : 'realm:l0',
      `account:principal:all-realms:${host.includes('hbbtzn') ? 'l1' : 'l0'}`,
      ticketTarget,
    ]);
    const ticket = harness.queries.find(({ text }) => text.includes('insert into identity.authticket'));
    expect(ticket?.values[6]).toBe(ticketTarget);
    expect(ticket?.values.slice(7)).toEqual(session?.values.slice(11, 13));
  });

  it('logs into one hosted member Realm selected by the storefront entry Realm', async () => {
    const password = 'Current!Password1';
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false, storefrontAvailable: true,
      boundMobilePrincipal: 'principal:hosted-member', boundMobileRealm: 'realm:member-hongtai',
      credentialSecret: await new PasswordPolicy().hash(password),
      loginMembershipRows: [{ id: 'membership:member-hongtai', access_version: 1, client: 'storefront',
        organization_id: 'mall:d1708f04df2dd8a61736852c4900fb43' }],
      storefrontOrganizationId: 'mall:d1708f04df2dd8a61736852c4900fb43' });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(passwordLoginRequest(SUBJECT, password, {
      target: 'storefront', application: 'zdt-l1-verify',
    }, 'hbbtzn.com'));

    expect(response).toMatchObject({ status: 201, body: {
      membership: 'membership:member-hongtai',
      active_context: { entry_realm_id: 'realm:l1', current_realm_id: 'realm:member-hongtai',
        active_membership_id: 'membership:member-hongtai', node_id: 'node:bound-member:l6' },
    } });
    const membership = harness.queries.find(({ text }) => text.includes('select membership.id,membership.access_version'));
    expect(membership?.values.slice(0, 2)).toEqual(['account:principal:hosted-member:l1', 'realm:member-hongtai']);
    const session = harness.queries.find(({ text }) => text.includes('insert into identity.session'));
    expect(session?.values.slice(11, 13)).toEqual(['realm:member-hongtai', 'account:principal:hosted-member:l1']);
  });

  it.each([
    ['api.zhudatuan.com', 'storefront', 'zdt-l1-verify'],
    ['hbbtzn.com', 'storefront', 'zhudatuan-storefront'],
  ])('rejects cross-realm parameters before credential lookup on %s', async (host, target, application) => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false });

    await expect(identityRegistrationOperations(context(harness.pool)).invoke(passwordLoginRequest(SUBJECT, 'Current!Password1', {
      target, ...(application === undefined ? {} : { application }),
    }, host))).rejects.toThrow('AUTH_REALM_MISMATCH');
    expect(harness.queries.some(({ text }) => text.includes('identity.credential'))).toBe(false);
    expect(harness.queries.some(({ text }) => /^\s*(insert|update|delete)\s+(identity|member|access)\./i.test(text))).toBe(false);
  });

  it('fails explicitly when the current realm has no membership and never falls back to another node', async () => {
    const password = 'Current!Password1';
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false,
      boundMobilePrincipal: 'principal:cross-node', credentialSecret: await new PasswordPolicy().hash(password),
      loginMembershipRows: [
        { id: 'membership:l0:admin', access_version: 1, client: 'operator', organization_id: 'tenant-zhudatuan' },
      ] });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(passwordLoginRequest(SUBJECT, password, {
      target: 'console',
    }, 'api.hbbtzn.com'));

    expect(response).toEqual({ status: 403, body: { code: 'REALM_MEMBERSHIP_NOT_FOUND' } });
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.session'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.authticket'))).toBe(false);
  });

  it('keeps the Hongtai Console node on its own auth ticket', async () => {
    const password = 'Current!Password1';
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false,
      boundMobilePrincipal: 'principal:hongtai-operator', credentialSecret: await new PasswordPolicy().hash(password),
      loginMembershipRows: [
        { id: 'membership:hongtai:operator', access_version: 1, client: 'operator', organization_id: 'mall:d1708f04df2dd8a61736852c4900fb43' },
      ] });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(passwordLoginRequest(SUBJECT, password, {
      target: 'console',
    }, 'api.hbbtzn.com'));

    expect(response).toMatchObject({ status: 201, body: { membership: 'membership:hongtai:operator', target: 'console' } });
    const ticket = harness.queries.find(({ text }) => text.includes('insert into identity.authticket'));
    expect(ticket?.values[6]).toBe('console');
  });

  it('completes the Console ticket exchange inside the session transaction when requested', async () => {
    const password = 'Current!Password1';
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false,
      boundMobilePrincipal: 'principal:hongtai-operator', credentialSecret: await new PasswordPolicy().hash(password),
      loginMembershipRows: [
        { id: 'membership:hongtai:operator', access_version: 1, client: 'operator', organization_id: 'mall:d1708f04df2dd8a61736852c4900fb43' },
      ] });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(passwordLoginRequest(SUBJECT, password, {
      target: 'console',
    }, 'api.hbbtzn.com', true));

    expect(response).toMatchObject({ status: 201, body: {
      membership: 'membership:hongtai:operator', target: 'console',
      exchange: { returnTarget: { url: 'https://console.hbbtzn.com/' }, expiresIn: expect.any(Number) },
    } });
    expect(harness.queries.some(({ text }) => text.includes('update identity.authticket ticket set consumed_at'))).toBe(true);
  });

  it('limits storefront login memberships to the requested application organization', async () => {
    const password = 'Current!Password1';
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false, storefrontAvailable: true,
      storefrontOrganizationId: 'mall:d1708f04df2dd8a61736852c4900fb43',
      boundMobilePrincipal: 'principal:storefront-login', credentialSecret: await new PasswordPolicy().hash(password),
      loginMembershipRows: [
        { id: 'membership:hongtai:one', access_version: 1, client: 'storefront', organization_id: 'mall:d1708f04df2dd8a61736852c4900fb43' },
        { id: 'membership:other', access_version: 1, client: 'storefront', organization_id: 'mall:l1-other' },
        { id: 'membership:hongtai:two', access_version: 1, client: 'storefront', organization_id: 'mall:d1708f04df2dd8a61736852c4900fb43' },
      ] });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(passwordLoginRequest(SUBJECT, password, {
      target: 'storefront', application: 'zdt-l1-verify',
    }, 'hbbtzn.com'));

    expect(response).toMatchObject({ status: 200, body: { memberships: [
      { id: 'membership:hongtai:one', client: 'storefront' },
      { id: 'membership:hongtai:two', client: 'storefront' },
    ] } });
  });

  it('rejects an L0 return target for the L1 storefront application', async () => {
    const password = 'Current!Password1';
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false, storefrontAvailable: true,
      boundMobilePrincipal: 'principal:storefront-login', credentialSecret: await new PasswordPolicy().hash(password),
      loginMembershipRows: [
        { id: 'membership:hongtai:one', access_version: 1, client: 'storefront', organization_id: 'mall:l1-hongtai' },
      ] });

    await expect(identityRegistrationOperations(context(harness.pool)).invoke(passwordLoginRequest(SUBJECT, password, {
      target: 'storefront', application: 'zdt-l1-verify',
    }))).rejects.toThrow('AUTH_REALM_MISMATCH');
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.authticket'))).toBe(false);
  });

  it('resolves an active storefront as the public L6 self-registration context', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false, storefrontAvailable: true });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(storefrontContextRequest());

    expect(response).toMatchObject({
      status: 200,
      body: {
        application_slug: 'zdt-l1-verify',
        organization_id: 'mall:l1-hongtai',
        organization_name: '宏泰甄选',
        target_client: 'storefront',
        terms_hash: 'f'.repeat(64),
      },
    });
  });

  it('creates a registration challenge from the storefront context without an invitation', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: false, storefrontAvailable: true });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(challengeRequest({
      destination: SUBJECT,
      purpose: 'registration',
      application: 'zdt-l1-verify',
    }));

    expect(response.status).toBe(202);
    expect(harness.queries.some(({ text }) => text.includes('select invite.id from member.invite'))).toBe(false);
    const storefront = harness.queries.find(({ text }) => text.includes('from experience.application application'));
    expect(storefront?.values).toEqual(['zdt-l1-verify']);
    const challenge = harness.queries.find(({ text }) => text.includes('with challenge as'));
    expect(challenge?.values[4]).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
  });

  it('reports an existing unified identity without creating a second account', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: true, storefrontAvailable: true });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(challengeRequest({
      destination: SUBJECT,
      purpose: 'registration',
      application: 'zdt-l1-verify',
    }));

    expect(response).toMatchObject({ status: 202, body: { identity_exists: true } });
    const challenge = harness.queries.find(({ text }) => text.includes('with challenge as'));
    expect(challenge?.values[1]).toBe('principal:existing-phone');
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.principal'))).toBe(false);
  });

  it('rejects mobile password login when the profile and credential belong to different principals', async () => {
    const harness = registrationHarness({ challengeAccepted: false, subjectExists: true,
      boundMobilePrincipal: 'principal:owner', credentialSecret: await new PasswordPolicy().hash('Current!Password1') });

    await expect(identityRegistrationOperations(context(harness.pool)).invoke(passwordLoginRequest(SUBJECT, 'Current!Password1')))
      .resolves.toEqual({ status: 409, body: { code: 'IDENTITY_SUBJECT_EXISTS' } });
    expect(harness.queries.some(({ text }) => text.includes('select credential.principal_id,credential.secret_hash'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.session'))).toBe(false);
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

  it('rolls back a storefront invitation when its subject already exists', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: true, inviteAccepted: true });
    const result = await identityOperations(context(harness.pool)).invoke(registrationRequest('registration:duplicate-subject'));

    expect(result).toEqual({ status: 409, body: { code: 'IDENTITY_SUBJECT_EXISTS' } });
    expect(harness.queries.some(({ text }) => text.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(harness.queries.some(({ text }) => text.includes('update identity.challenge set consumed_at'))).toBe(true);
    expect(harness.queries.some(({ text }) => text.includes('select invite.id,invite.organization_id,invite.created_by'))).toBe(true);
    expect(harness.queries.some(({ text }) => text.includes('with candidate as materialized'))).toBe(false);
    expect(harness.queries.some(({ text }) => text === 'rollback to savepoint identity_business_mutation')).toBe(true);
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.principal'))).toBe(false);
  });

  it('rolls back a storefront invitation when its mobile is bound to an account-name identity', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false, inviteAccepted: true,
      boundMobilePrincipal: 'principal:owner-mobile' });

    const result = await identityOperations(context(harness.pool)).invoke(registrationRequest('registration:bound-mobile'));

    expect(result).toEqual({ status: 409, body: { code: 'IDENTITY_SUBJECT_EXISTS' } });
    expect(harness.queries.some(({ text }) => text.includes('update identity.challenge set consumed_at'))).toBe(true);
    expect(harness.queries.some(({ text }) => text.includes('select invite.id,invite.organization_id,invite.created_by'))).toBe(true);
    expect(harness.queries.some(({ text }) => text.includes('with candidate as materialized'))).toBe(false);
    expect(harness.queries.some(({ text }) => text === 'rollback to savepoint identity_business_mutation')).toBe(true);
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.principal'))).toBe(false);
  });

  it('rolls back phone proof, invitation, account and membership when final WeChat binding rejects', async () => {
    const harness = registrationHarness({
      challengeAccepted: true,
      subjectExists: false,
      inviteAccepted: true,
      wechatGrant: true,
      wechatConflict: true,
    });
    const request = registrationRequest('registration:wechat-conflict');
    const response = await identityOperations(context(harness.pool)).invoke({
      ...request,
      input: {
        ...request.input,
        body: { ...(request.input.body as Readonly<Record<string, unknown>>), wechatToken: 'wechat-binding-token' },
      },
    });

    expect(response).toEqual({ status: 409, body: { code: 'WECHAT_IDENTITY_ALREADY_BOUND' } });
    const rollback = harness.queries.findIndex(({ text }) => text === 'rollback to savepoint identity_business_mutation');
    for (const mutation of [
      'update identity.challenge set consumed_at',
      'organization.register_hosted_member_node',
      'insert into identity.principal',
      'insert into identity.account',
      'insert into access.membership(',
    ]) {
      const index = harness.queries.findIndex(({ text }) => text.includes(mutation));
      expect(index, mutation).toBeGreaterThanOrEqual(0);
      expect(index, mutation).toBeLessThan(rollback);
    }
    expect(rollback).toBeGreaterThanOrEqual(0);
    expect(harness.queries.findIndex(({ text }) => text.startsWith('update runtime.idempotency'))).toBeGreaterThan(rollback);
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
        registration_origin: 'direct',
        signed_level: 'L6',
        parent_node_id: 'node:hbbtzn:l1',
        node_id: expect.stringMatching(/^node:member-/),
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

  it('returns an idempotent L11 invitation boundary before creating identity or membership rows', async () => {
    const harness = registrationHarness({
      challengeAccepted: true,
      subjectExists: false,
      inviteAccepted: true,
      registrationBoundary: true,
    });

    const response = await identityRegistrationOperations(context(harness.pool))
      .invoke(registrationRequest('registration:l11-boundary'));

    expect(response).toMatchObject({
      status: 409,
      body: {
        code: 'SFL_REGISTRATION_LEVEL_BOUNDARY',
        outcome: 'level_boundary',
        registration_origin: 'invitation',
        inviter_node_id: 'node:inviter:l11',
        business_number: expect.stringMatching(/^SFLREG-/),
      },
    });
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.principal'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('insert into access.membership('))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('organization.register_hosted_member_node'))).toBe(true);
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
    expect(session?.values.slice(9)).toEqual([1, expect.stringMatching(/^realm:member-/), expect.stringMatching(/^account:/), 'storefront']);
  });

  it('binds a new membership and session to the generated consumer-node realm', async () => {
    const harness = registrationHarness({
      challengeAccepted: false,
      subjectExists: false,
      storefrontAvailable: true,
    });

    const response = await identityRegistrationOperations(context(harness.pool))
      .invoke(storefrontPasswordRegistrationRequest('registration:consumer-node'));

    expect(response).toMatchObject({
      status: 201,
      body: { organization_id: 'mall:l1-hongtai', client: 'storefront', authentication: { target: 'storefront' } },
    });
    const binding = harness.queries.find(({ text }) => text.includes('insert into access.membership(')
      && text.includes('realm.node_profile'));
    expect(binding?.text).toContain('from identity.realm realm');
    expect(binding?.values.slice(4, 6)).toEqual([expect.stringMatching(/^realm:member-/), expect.stringMatching(/^account:/)]);
    const session = harness.queries.find(({ text }) => text.includes('insert into identity.session'));
    expect(session?.values.slice(9)).toEqual([1, expect.stringMatching(/^realm:member-/), expect.stringMatching(/^account:/), 'storefront']);
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
        'set-cookie': expect.stringContaining('shop_storefront_session='),
        'x-set-cookie': expect.stringContaining('shop_storefront_csrf='),
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

  it('turns an operator invitation into one independent pending-operator membership', async () => {
    const harness = registrationHarness({ challengeAccepted: true, subjectExists: false, inviteAccepted: true, operatorInvite: true });

    const response = await identityRegistrationOperations(context(harness.pool))
      .invoke(registrationRequest('registration:operator-complete'));

    expect(response).toMatchObject({ status: 201, body: { client: 'operator', governanceLevel: 'administrator' } });
    const memberships = harness.queries.filter(({ text }) => text.includes('insert into access.membership('));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.text).toContain("'operator'");
    expect(memberships[0]?.values).toContain('tenant-zhudatuan');
    expect(memberships[0]?.text).not.toContain("'storefront'");
    const invitationConsumption = harness.queries.find(({ text }) => text.includes('with candidate as materialized')
      && text.includes('update member.invite'));
    expect(invitationConsumption?.text).toContain("accepted_membership_id=case when candidate.target_client='operator' then $3");
    expect(memberships[0]?.values).toContain(invitationConsumption?.values[2]);
    const roles = harness.queries.filter(({ text }) => text.includes('insert into access.membershiprole'));
    expect(roles).toHaveLength(1);
    expect(roles[0]?.values).toContain('role-zhudatuan-pending-operator');
  });

  it('turns a senior invitation into a tenant-scoped senior operator without creating Owner state', async () => {
    const harness = registrationHarness({
      challengeAccepted: true, subjectExists: false, inviteAccepted: true, operatorInvite: true, seniorInvite: true,
    });

    const response = await identityRegistrationOperations(context(harness.pool))
      .invoke(registrationRequest('registration:senior-complete'));

    expect(response).toMatchObject({ status: 201, body: { client: 'operator', governanceLevel: 'senior_administrator' } });
    const roles = harness.queries.filter(({ text }) => text.includes('insert into access.membershiprole'));
    expect(roles[0]?.values).toContain('role-senior-administrator-v1:tenant-zhudatuan');
    expect(harness.queries.some(({ text }) => text.includes('insert into access.platformowner'))).toBe(false);
    const operatorScopes = harness.queries.find(({ text, values }) => text.includes('insert into access.scopegrant')
      && values.includes('tenant-zhudatuan'));
    expect(operatorScopes?.text).toContain("'tenant'");
    const membership = harness.queries.find(({ text }) => text.includes('insert into access.membership('));
    expect(membership?.text).toContain('operator_display_name');
    expect(membership?.values).toContain('测试会员');
  });

  it('creates an L1 operator account for an existing hosted consumer without changing the consumer membership', async () => {
    const operatorOrganization = 'mall:d1708f04df2dd8a61736852c4900fb43';
    const harness = registrationHarness({
      challengeAccepted: true,
      subjectExists: true,
      inviteAccepted: true,
      operatorInvite: true,
      seniorInvite: true,
      storefrontOrganizationId: operatorOrganization,
      boundMobileRealm: 'realm:member-hongtai',
      credentialSecret: 'existing-consumer-password-hash',
    });
    const base = registrationRequest('registration:l1-existing-senior');
    const body = { ...(base.input.body as Readonly<Record<string, unknown>>) } as Record<string, unknown>;
    delete body.password;

    const response = await identityRegistrationOperations(context(harness.pool)).invoke({
      ...base,
      input: {
        ...base.input,
        headers: { ...base.input.headers, host: 'api.hbbtzn.com' },
        body,
      },
    });

    expect(response).toMatchObject({
      status: 201,
      body: { client: 'operator', organization_id: operatorOrganization, governanceLevel: 'senior_administrator' },
    });
    expect(harness.queries.some(({ text }) => text.includes('insert into identity.principal'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('insert into member.profile'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('organization.register_hosted_member_node'))).toBe(false);
    const account = harness.queries.find(({ text }) => text.includes('insert into identity.account'));
    expect(account?.values.slice(1, 3)).toEqual(['realm:l1', 'principal:existing-phone']);
    const credential = harness.queries.find(({ text }) => text.includes('insert into identity.credential'));
    expect(credential?.values.slice(1, 5)).toEqual([
      'principal:existing-phone', subjectDigest(SUBJECT), 'existing-consumer-password-hash', 'realm:l1',
    ]);
    const memberships = harness.queries.filter(({ text }) => text.includes('insert into access.membership('));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.text).toContain("'operator'");
    expect(memberships[0]?.values).toContain(operatorOrganization);
    expect(memberships[0]?.values[4]).toBe('realm:l1');
    expect(memberships[0]?.values[5]).toBe(account?.values[0]);
    expect(memberships[0]?.text).toContain('operator_display_name');
    expect(memberships[0]?.values).toContain('测试会员');
    expect(memberships[0]?.text).not.toContain("'storefront'");
    const role = harness.queries.find(({ text }) => text.includes('insert into access.membershiprole'));
    expect(role?.values).toContain('role-senior-administrator-v1:tenant-zhudatuan');
    const grant = harness.queries.find(({ text }) => text.includes('insert into access.scopegrant'));
    expect(grant?.values).toContain('tenant-zhudatuan');
  });

  it('reactivates an offboarded operator after a new administrator invitation without changing storefront membership', async () => {
    const harness = registrationHarness({
      challengeAccepted: true, subjectExists: true, inviteAccepted: true, operatorInvite: true, seniorInvite: true,
      storefrontOrganizationId: 'mall:d1708f04df2dd8a61736852c4900fb43', boundMobileRealm: 'realm:l1',
      credentialSecret: 'existing-password-hash', existingOperatorStatus: 'offboarded',
    });
    const base = registrationRequest('registration:reactivate-operator');
    const body = { ...(base.input.body as Readonly<Record<string, unknown>>) } as Record<string, unknown>;
    delete body.password;

    const response = await identityRegistrationOperations(context(harness.pool)).invoke({
      ...base,
      input: { ...base.input, headers: { ...base.input.headers, host: 'api.hbbtzn.com' }, body },
    });

    expect(response).toMatchObject({ status: 201, body: { id: 'membership:existing-operator', client: 'operator',
      status: 'active', governanceLevel: 'senior_administrator' } });
    expect(harness.queries.some(({ text }) => text.startsWith("update access.membership set status='active'"))).toBe(true);
    expect(harness.queries.some(({ text }) => text.includes('insert into access.membership(') && text.includes("'operator'"))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes("client='storefront'") && text.startsWith('update'))).toBe(false);
  });
});

function registrationRequest(idempotency: string, directLogin = false): OperationRequest {
  return {
    type: 'identity.members.create',
    access: null,
    input: {
      path: {},
      query: {},
      headers: { host: 'api.zhudatuan.com', 'x-device-id': 'device:registration-test' },
      body: {
        subject: SUBJECT,
        password: 'Registration!Password1',
        displayName: '测试会员',
        challenge: 'challenge:registration',
        code: '123456',
        invite: 'INVITE-CODE',
        termsAccepted: true,
        termsHash: 'f'.repeat(64),
        ...(directLogin ? { target: 'storefront', authorization: authorizationRequest() } : {}),
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
      headers: { host: 'api.hbbtzn.com', 'x-device-id': 'device:storefront-registration-test' },
      body: {
        subject: SUBJECT,
        password: '654321',
        displayName: 'L6消费者8000',
        challenge: 'challenge:registration',
        code: '123456',
        application: 'zdt-l1-verify',
        target: 'storefront',
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
      headers: { host: 'api.hbbtzn.com', 'x-device-id': 'device:storefront-registration-test' },
      body: {
        subject: SUBJECT,
        password: 'Automatic!Password1',
        displayName: 'L6消费者8000',
        application: 'zdt-l1-verify',
        target: 'storefront',
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

function consumerNodePasswordRegistrationRequest(idempotency: string): OperationRequest {
  const request = storefrontPasswordRegistrationRequest(idempotency);
  return {
    ...request,
    input: {
      ...request.input,
      headers: { ...request.input.headers, host: 'api.l6.identity.test' },
      body: { ...(request.input.body as Readonly<Record<string, unknown>>), application: 'l6-storefront', target: 'storefront' },
    },
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
      headers: { host: body.application === 'zdt-l1-verify' ? 'api.hbbtzn.com' : 'api.zhudatuan.com',
        'x-device-id': 'device:registration-test' },
      body,
      rawBody: '',
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
      idempotency: 'registration:challenge-purpose',
    },
  };
}

function passwordLoginRequest(subject: string, password: string,
  entry: Readonly<{ target: string; application?: string }> = { target: 'console' },
  host = 'api.zhudatuan.com', directExchange = false): OperationRequest {
  const verifier = 'v'.repeat(43);
  const authorization = directExchange
    ? { state: 's'.repeat(32), nonce: 'n'.repeat(32), challenge: createHash('sha256').update(verifier).digest('base64url') }
    : authorizationRequest();
  return {
    type: 'identity.sessions.create',
    access: null,
    input: {
      path: {}, query: {}, headers: { host, 'x-device-id': 'device:password-login-test' },
      body: { provider: 'password', subject, password, ...entry, authorization,
        ...(directExchange ? { exchange: { nonce: authorization.nonce, verifier } } : {}) },
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
      path: {}, query: {}, headers: { host: 'api.zhudatuan.com', 'x-device-id': 'device:stepup-test' }, body, rawBody: JSON.stringify(body),
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

function stepupCompleteRequest(bindingToken?: string): OperationRequest {
  return authenticatedRequest('identity.stepup.complete', {
    challenge: 'challenge:stepup', code: '123456', ...(bindingToken === undefined ? {} : { bindingToken }),
  }, 'stepup:complete');
}

function passwordResetRequest(): OperationRequest {
  return {
    type: 'identity.password.reset', access: null,
    input: {
      path: {}, query: {}, headers: { host: 'api.zhudatuan.com', 'x-device-id': 'device:password-reset' },
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
      path: {}, query: {}, headers: { host: 'api.zhudatuan.com', 'x-device-id': `device:${idempotency}` }, body, rawBody: JSON.stringify(body),
      deadline: Date.now() + 5_000, signal: new AbortController().signal, idempotency,
    },
  };
}

function registrationHarness(input: Readonly<{ challengeAccepted: boolean; subjectExists: boolean; inviteAccepted?: boolean; operatorInvite?: boolean;
  seniorInvite?: boolean;
  registrationBoundary?: boolean;
  storefrontAvailable?: boolean;
  storefrontOrganizationId?: string;
  mobileCiphertext?: string | null; passwordEvidence?: boolean; exactOwner?: boolean;
  challengePrincipal?: string | null; boundMobilePrincipal?: string | null; boundMobileRealm?: string;
  credentialSecret?: string; ownerPasswordRotation?: boolean; loginMemberships?: boolean;
  loginMembershipRows?: ReadonlyArray<Readonly<{ id: string; access_version: number; client: string; organization_id: string }>>;
  existingMembership?: boolean; existingOperatorStatus?: string; wechatGrant?: boolean; wechatConflict?: boolean; wechatUpdate?: boolean }>): Readonly<{
  pool: DatabasePool;
  queries: ReadonlyArray<Readonly<{ text: string; values: readonly unknown[] }>>;
}> {
  let requestHash = '';
  const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
  const client = {
    query: async (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values });
      if (text.includes('from identity.realmentry entry')) {
        const l6 = String(values[0]).includes('l6.identity.test');
        const l1 = String(values[0]).includes('hbbtzn');
        return result([{ realm_id: l6 ? 'realm:l6' : l1 ? 'realm:l1' : 'realm:l0',
          node_id: l6 ? 'node:fixture:l6' : l1 ? 'node:hbbtzn:l1' : 'node:zhudatuan:l0' }]);
      }
      if (text.includes('from identity.realmtarget where realm_id=$1')) {
        const target = String(values[1]);
        const consumer = target.startsWith('storefront');
        const l1 = values[0] === 'realm:l1';
        const l6 = values[0] === 'realm:l6';
        if (l6 && target !== 'storefront') return result([]);
        if (!['console', 'storefront', 'store', 'supplier'].includes(target)) return result([]);
        return result([{
          surface: consumer ? 'consumer' : 'admin',
          membership_client: consumer ? 'storefront' : target.startsWith('store') ? 'store' : target.startsWith('supplier') ? 'supplier' : 'operator',
          membership_organization_id: consumer
            ? (l1 ? input.storefrontOrganizationId ?? 'mall:l1-hongtai' : 'mall-zhudatuan')
            : l1 ? 'mall:d1708f04df2dd8a61736852c4900fb43' : 'tenant-zhudatuan',
          application_slug: consumer ? (l6 ? 'l6-storefront' : l1 ? 'zdt-l1-verify' : 'zhudatuan-storefront') : null,
        }]);
      }
      if (text.includes('from identity.realmtarget target join identity.realm realm')) {
        const l1 = values[0] === 'realm:l1';
        return result([{
          node_id: l1 ? 'node:hbbtzn:l1' : 'node:zhudatuan:l0', entry_host: l1 ? 'api.hbbtzn.com' : 'api.zhudatuan.com',
          target: 'storefront', surface: 'consumer', membership_client: 'storefront',
          membership_organization_id: l1 ? input.storefrontOrganizationId ?? 'mall:l1-hongtai' : 'mall-zhudatuan',
          application_slug: String(values[1]),
        }]);
      }
      if (text.includes('from access.membership membership join identity.account account')
        && text.includes('membership.id=$1') && text.includes('account.legacy_principal_id=$2')) {
        return result([{ account_id: 'account:stepup:l0', realm_id: 'realm:l0',
          principal_id: String(values[1]), credential_version: 1 }]);
      }
      if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
      if (text.includes("update runtime.idempotency set state='completed'")) return { rows: [], rowCount: 1 } as unknown as QueryResult;
      if (text.includes('update identity.authticket ticket set consumed_at')) {
        return result([{ target: 'console', return_origin: 'https://console.hbbtzn.com/', expires_at: new Date(Date.now() + 3_600_000) }]);
      }
      if (text.startsWith('select request_hash,state,response')) {
        return result([{ request_hash: requestHash, state: 'started', response: null }]);
      }
      if (text.includes('select account.id account_id,account.realm_id,account.legacy_principal_id principal_id')
        && text.includes('credential.subject_hash=$2') && text.includes('limit 1 for update')) {
        return result(input.subjectExists ? [{ account_id: 'account:existing-phone:l0',
          realm_id: input.boundMobileRealm ?? 'realm:l0', principal_id: 'principal:existing-phone', credential_version: 4,
          secret_hash: input.credentialSecret ?? 'existing-password-hash' }] : []);
      }
      if (text.includes('from experience.application application') && text.includes('application.public_slug=$1')) {
        const l1 = values[0] === 'zdt-l1-verify';
        const l6 = values[0] === 'l6-storefront';
        const l1Organization = input.storefrontOrganizationId ?? 'mall:l1-hongtai';
        return result(input.storefrontAvailable ? [{
          application_id: l6 ? 'application:l6-storefront' : l1 ? 'application:zdt-l1-verify' : 'application:zhudatuan-storefront',
          application_slug: l6 ? 'l6-storefront' : l1 ? 'zdt-l1-verify' : 'zhudatuan-storefront',
          organization_id: l1 ? l1Organization : 'mall-zhudatuan', organization_name: l1 ? '宏泰甄选' : '主打团',
          role_id: l1 ? `role-zhudatuan-storefront-member:${l1Organization}` : 'role-zhudatuan-storefront-member',
          terms_title: '主打团用户服务协议', terms_body: '服务协议正文',
          privacy_title: '主打团隐私政策', privacy_body: '隐私政策正文', terms_hash: 'f'.repeat(64),
        }] : []);
      }
      if (text.includes('where account.id=$1') && text.includes("credential.provider='password'")) {
        return result([{ account_id: String(values[0]), realm_id: input.boundMobileRealm ?? String(values[1]),
          principal_id: input.boundMobilePrincipal ?? 'principal:existing-phone', credential_version: 4,
          secret_hash: input.credentialSecret ?? 'existing-password-hash' }]);
      }
      if (text.includes('where account.realm_id=$1 and account.legacy_principal_id=$2')) {
        return result(input.boundMobileRealm === values[0] ? [{
          account_id: 'account:existing-phone:target', realm_id: String(values[0]), credential_version: 4,
        }] : []);
      }
      if (text.includes('select principal_id from identity.credential')) {
        return result([{ principal_id: input.challengePrincipal ?? 'principal:password-reset' }]);
      }
      if (text.includes('account.mobile_token=any') && !text.includes('join access.membership membership')) {
        const principals = [
          input.boundMobilePrincipal,
          input.subjectExists ? 'principal:existing-phone' : null,
          input.challengePrincipal,
        ].filter((principal, index, all): principal is string => principal !== null && principal !== undefined
          && all.indexOf(principal) === index);
        return result(principals.map((principal_id) => ({ account_id: `account:${principal_id}:${String(values[0]).slice(6)}`,
          realm_id: input.boundMobileRealm ?? String(values[0]),
          principal_id, credential_version: 4 })));
      }
      if (text.includes('account.credential_version,credential.secret_hash')
        && text.includes('join access.membership membership')) {
        const principals = [
          input.boundMobilePrincipal ?? 'principal:password-login',
          input.subjectExists ? 'principal:existing-phone' : null,
        ].filter((principal, index, all): principal is string => principal !== null && all.indexOf(principal) === index);
        return result(input.credentialSecret ? principals.map((principal) => ({
          account_id: `account:${principal}:${String(values[0]).slice(6)}`,
          realm_id: input.boundMobileRealm ?? String(values[0]), principal_id: principal,
          secret_hash: input.credentialSecret, credential_version: 2,
        })) : []);
      }
      if (text.includes('select membership.id,membership.access_version,membership.client')) {
        const rows = input.loginMembershipRows ?? (input.loginMemberships ? [
          { id: 'membership:console:one', access_version: 1, client: 'operator', organization_id: 'tenant-zhudatuan' },
          { id: 'membership:console:two', access_version: 1, client: 'operator', organization_id: 'tenant-zhudatuan' },
        ] : []);
        return result(rows.filter((row) => row.client === values[2] && row.organization_id === values[3]));
      }
      if (text.includes('with challenge as') && text.includes('identity.challengesecret')) {
        return result([{ id: String(values[0]), purpose: String(values[2]), expires_at: '2099-01-01T00:00:00.000Z' }]);
      }
      if (text.includes('update identity.challenge set consumed_at')) {
        const principal = input.challengePrincipal ?? null;
        return result(input.challengeAccepted ? [{ principal_id: principal, realm_id: 'realm:l0',
          account_id: principal === null ? null : `account:${principal}:l0` }] : []);
      }
      if (text.includes('with candidate as materialized') && text.includes('update member.invite')) {
        return result(input.inviteAccepted ? [input.operatorInvite ? {
          id: 'invite:operator', created_by: 'membership:inviter-operator',
          organization_id: 'tenant-zhudatuan',
          role_id: input.seniorInvite ? 'role-senior-administrator-v1:tenant-zhudatuan' : 'role-zhudatuan-pending-operator',
          terms_hash: 'f'.repeat(64), target_client: 'operator',
          storefront_organization_id: input.storefrontOrganizationId ?? 'mall-zhudatuan',
          storefront_role_id: 'role-zhudatuan-storefront-member',
          governance_level: input.seniorInvite ? 'senior_administrator' : 'administrator',
        } : {
          id: 'invite:storefront', created_by: 'membership:inviter-l6',
          organization_id: 'mall-zhudatuan', role_id: 'role-zhudatuan-storefront-member', terms_hash: 'f'.repeat(64),
          target_client: 'storefront', storefront_organization_id: null,
          storefront_role_id: 'role-zhudatuan-storefront-member', governance_level: null,
        }] : []);
      }
      if (text.includes('select invite.id,invite.organization_id,invite.created_by,invite.role_id')) {
        return result(input.inviteAccepted ? [input.operatorInvite ? {
          id: 'invite:operator', created_by: 'membership:inviter-operator', organization_id: 'tenant-zhudatuan',
          role_id: input.seniorInvite ? 'role-senior-administrator-v1:tenant-zhudatuan' : 'role-zhudatuan-pending-operator',
          terms_hash: 'f'.repeat(64), target_client: 'operator',
          storefront_organization_id: input.storefrontOrganizationId ?? 'mall-zhudatuan',
          storefront_role_id: 'role-zhudatuan-storefront-member',
          governance_level: input.seniorInvite ? 'senior_administrator' : 'administrator',
        } : {
          id: 'invite:storefront', created_by: 'membership:inviter-l6', organization_id: 'mall-zhudatuan',
          role_id: 'role-zhudatuan-storefront-member', terms_hash: 'f'.repeat(64), target_client: 'storefront',
          storefront_organization_id: null, storefront_role_id: 'role-zhudatuan-storefront-member', governance_level: null,
        }] : []);
      }
      if (text.includes('select * from organization.register_hosted_member_node')) {
        const request = JSON.parse(String(values[0])) as Record<string, string | null>;
        const invited = request.registration_origin === 'invitation';
        const targetLevel = invited ? 'L7' : 'L6';
        const nodeId = `node:${request.node_key}:${targetLevel.toLowerCase()}`;
        const at = '2026-09-12T02:00:00.000Z';
        if (input.registrationBoundary) return result([{
          outcome: 'level_boundary', registration_id: request.registration_id, business_number: request.business_number,
          registration_origin: 'invitation', registration_host_node_id: request.registration_host_node_id,
          invitation_id: 'invite:storefront', inviter_node_id: 'node:inviter:l11',
          inviter_membership_id: 'membership:inviter-l11', node_id: null, line_id: 'line:zhudatuan:commerce:v1',
          parent_node_id: null, signed_level: null, relation_version: null,
          host_sovereign_node_id: request.registration_host_node_id, realm_id: 'realm:l0', membership_id: null,
          effective_at: null, accepted_at: null, idempotency_key: request.idempotency_key,
          request_hash: 'a'.repeat(64), created_at: at, replayed: false,
        }]);
        return result([{
          outcome: 'registered', registration_id: request.registration_id, business_number: request.business_number,
          registration_origin: request.registration_origin, registration_host_node_id: request.registration_host_node_id,
          invitation_id: invited ? 'invite:storefront' : null, inviter_node_id: invited ? 'node:inviter:l6' : null,
          inviter_membership_id: invited ? 'membership:inviter-l6' : null, node_id: nodeId,
          line_id: 'line:zhudatuan:commerce:v1', parent_node_id: invited ? 'node:inviter:l6' : request.registration_host_node_id,
          signed_level: targetLevel, relation_version: 1, host_sovereign_node_id: request.registration_host_node_id,
          realm_id: request.realm_id, membership_id: request.membership_id, effective_at: at, accepted_at: at,
          idempotency_key: request.idempotency_key, request_hash: 'a'.repeat(64), created_at: at, replayed: false,
        }]);
      }
      if (text.includes('identity.resolve_active_membership_context')) {
        const registrationQuery = [...queries].reverse().find((query) => query.text.includes('organization.register_hosted_member_node'));
        const registrationRequest = registrationQuery === undefined
          ? undefined
          : JSON.parse(String(registrationQuery.values[0])) as Record<string, string>;
        const currentRealm = registrationRequest?.realm_id ?? input.boundMobileRealm ?? String(values[0]);
        const boundHosted = input.boundMobileRealm !== undefined && input.boundMobileRealm !== String(values[0]);
        const nodeId = registrationRequest === undefined
          ? (boundHosted ? 'node:bound-member:l6'
            : String(values[0]).includes('l1') ? 'node:hbbtzn:l1' : 'node:zhudatuan:l0')
          : `node:${registrationRequest.node_key}:${registrationRequest.registration_origin === 'invitation' ? 'l7' : 'l6'}`;
        const hosted = registrationRequest !== undefined || boundHosted;
        return result([{
          entry_realm_id: String(values[0]), current_realm_id: currentRealm, account_id: String(values[1]),
          active_membership_id: String(values[2]), line_id: 'line:zhudatuan:commerce:v1', node_id: nodeId,
          parent_node_id: hosted ? (registrationRequest?.registration_origin === 'invitation'
            ? 'node:inviter:l6' : 'node:hbbtzn:l1') : null,
          signed_level: hosted ? (registrationRequest?.registration_origin === 'invitation' ? 'L7' : 'L6') : 'L1',
          sovereignty_tier: hosted ? 'hosted' : 'sovereign', node_profile: hosted ? 'consumer' : 'operating_mall',
          mall_id: hosted ? null : 'mall:l1-hongtai', host_sovereign_node_id: 'node:hbbtzn:l1',
          relation_version: 1, effective_at: '2026-09-12T02:00:00.000Z', access_version: 1, status: 'active',
        }]);
      }
      if (text.includes('select mobile_ciphertext from identity.account')) {
        return result(input.mobileCiphertext === undefined ? [] : [{ mobile_ciphertext: input.mobileCiphertext }]);
      }
      if (text.includes('from identity.wechatgrant bindinggrant')) {
        return result(input.wechatGrant ? [{ identity_id: 'identity:wechat', application_hash: 'hash:application' }] : []);
      }
      if (text.includes("account_id=$3 and status='active'")) return result(input.wechatConflict ? [{ exists: 1 }] : []);
      if (text.startsWith('update identity.federatedidentity')) {
        return result(input.wechatUpdate === false ? [] : [{ id: 'identity:wechat' }]);
      }
      if (text.includes("values($1,$2,'stepup'")) return result([{ id: String(values[0]), purpose: 'stepup' }]);
      if (text.includes("values($1,$2,'phone_change'")) return result([{ id: String(values[0]), purpose: 'phone_change' }]);
      if (text.includes("method='password'") && text.includes('evidence_hash')) return result(input.passwordEvidence ? [{ exists: 1 }] : []);
      if (text.includes('select id,secret_hash from identity.credential')) {
        return result(input.credentialSecret ? [{ id: 'credential:password:test', secret_hash: input.credentialSecret }] : []);
      }
      if (text.includes('select secret_hash from identity.credential')) {
        return result(input.credentialSecret ? [{ secret_hash: input.credentialSecret }] : []);
      }
      if (text.includes('identity.rotate_zhudatuan_owner_password')) {
        return result([{ result: input.ownerPasswordRotation
          ? { credential_version: 2, version: 2, sessions_revoked: 1 } : null }]);
      }
      if (text.includes('from access.platformowner owner')) return result([{ exact_owner: input.exactOwner === true }]);
      if (text.includes('access.change_zhudatuan_owner_mobile')) {
        return result([{ profile: { id: 'member:test', display_name: '测试会员', mobile_masked: '138****8000',
          version: 2, session_revoked: true, access_version: 2 } }]);
      }
      if (text.includes('select id from identity.credential')) return result([{ id: 'credential:password:test' }]);
      if (text.includes('update member.profile set mobile_ciphertext')) {
        return result([{ id: 'member:test', display_name: '测试会员', mobile_masked: '138****8000', version: 2 }]);
      }
      if (text.includes('update identity.principal set credential_version')) return result([{ credential_version: 2, version: 2 }]);
      if (text.includes('update identity.account set credential_version=credential_version+1')) {
        return result([{ credential_version: 2, version: 2 }]);
      }
      if (text.includes('update identity.session set assurance_level=3')) {
        return result([{ id: 'session:stepup', assurance_level: 3 }]);
      }
      if (text.includes('select kind from organization.organization')) return result([{ kind: 'mall' }]);
      if (text.includes("select id from member.profile where principal_id=$1 and status='active'")) {
        return result([{ id: 'member:existing-phone' }]);
      }
      if (text.includes("select * from access.membership") && text.includes("client='storefront'")) {
        return result(input.existingMembership ? [{
          id: 'membership:existing-storefront', member_id: 'member:existing-phone', organization_id: 'mall-zhudatuan',
          client: 'storefront', employee_no: null, status: 'active', access_version: 3,
          joined_at: '2026-09-03T00:00:00.000Z', left_at: null,
        }] : []);
      }
      if (text.includes("select * from access.membership") && text.includes("client='operator'")) {
        return result(input.existingOperatorStatus === undefined ? [] : [{
          id: 'membership:existing-operator', member_id: 'member:existing-phone',
          organization_id: 'mall:d1708f04df2dd8a61736852c4900fb43', client: 'operator',
          status: input.existingOperatorStatus, access_version: 3, joined_at: '2026-09-03T00:00:00.000Z', left_at: null,
        }]);
      }
      if (text.startsWith("update access.membership set status='active'")) {
        return result([{ id: String(values[0]), member_id: String(values[3]), organization_id: String(values[4]),
          client: 'operator', realm_id: String(values[5]), account_id: String(values[6]), status: 'active',
          access_version: 4, joined_at: '2026-09-13T00:00:00.000Z', left_at: null }]);
      }
      if (text.includes('insert into access.membership(') && text.includes('returning *')) {
        return result([{
          id: String(values[0]), member_id: String(values[1]), organization_id: String(values[2]),
          client: text.includes("'operator'") ? 'operator' : 'storefront', employee_no: values[3] ?? null,
          realm_id: String(values[4]), account_id: String(values[5]), node_profile: 'consumer',
          status: 'active', access_version: 1,
          joined_at: '2026-09-03T00:00:00.000Z', left_at: null,
        }]);
      }
      if (text.includes('from access.membership membership join identity.realm realm')
        && text.includes('membership.id=any')) {
        const memberships = Array.isArray(values[0]) ? values[0] : [values[0]];
        return result(memberships.map((id) => ({ id })));
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

function context(pool: DatabasePool, kms: KmsClient = {
  encrypt: async () => ({ ciphertext: 'encrypted-value', fingerprint: 'f'.repeat(64), keyVersion: 'v1' }),
} as unknown as KmsClient, notificationNode?: string): ModuleContext {
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
    jsSdkConfiguration: async () => { throw new Error('not used'); },
  });
  if (notificationNode) container.bind(NODE_MANIFEST, {
    node_id: notificationNode,
    parent_node_id: 'node:zhudatuan:l0',
  } as never);
  return { container } as unknown as ModuleContext;
}

function subjectDigest(subject: string): string {
  return createHmac('sha256', IDENTITY_KEY).update(subject.trim().toLowerCase()).digest('hex');
}

function sessionEvidenceDigest(session: string): string {
  return createHash('sha256').update(session).digest('hex');
}

function challengeCodeDigest(challenge: string, code: string): string {
  return createHmac('sha256', 'session-key').update(`${challenge}:${code}`).digest('hex');
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
