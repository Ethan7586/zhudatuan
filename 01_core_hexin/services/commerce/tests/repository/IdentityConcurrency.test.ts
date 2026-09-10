import { createHash, createHmac } from 'node:crypto';
import { IDENTITY_NODE_MANIFEST, type IdentityNodeManifestNode } from '@shop/config/identity-node-manifest';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Container } from '../../src/bootstrap/Container';
import type { ModuleContext } from '../../src/bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../src/foundation/application/AuditSink';
import type { OperationRequest, OperationResult, OperationUsecase } from '../../src/foundation/application/OperationHandler';
import { KMS_CLIENT, type KmsClient } from '../../src/foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS } from '../../src/foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../src/foundation/persistence/Pool';
import type { AccessContext } from '../../src/foundation/security/AccessContext';
import { identityOperations, identityRegistrationOperations } from '../../src/modules/identity/05_interface_jieru/http/IdentityOperations';
import { MemberPort } from '../../src/modules/member/01_public_gongkai/MemberPort';

const adminConnection = process.env.SHOP_TEST_ADMIN_DATABASE_URL;
const runtimeConnection = process.env.SHOP_TEST_DATABASE_URL;
const appConnection = process.env.SHOP_TEST_APP_DATABASE_URL;
const IDENTITY_KEY = 'sfl95-identity-key';
const SESSION_KEY = 'sfl95-session-key';
const nodes = [node('node:zhudatuan:l0'), node('node:hbbtzn:l1')];

interface NodeSpec {
  readonly id: string;
  readonly realm: string;
  readonly host: string;
  readonly target: string;
  readonly application: string;
  readonly organization: string;
}

interface UserFixture {
  readonly subject: string;
  readonly password: string;
  readonly node: NodeSpec;
  readonly key: string;
}

interface AuthorizationFixture {
  readonly state: string;
  readonly nonce: string;
  readonly challenge: string;
  readonly verifier: string;
}

interface Outcome {
  readonly key: string;
  readonly milliseconds: number;
  readonly result?: OperationResult;
  readonly error?: string;
}

describe.runIf(adminConnection !== undefined && runtimeConnection !== undefined && appConnection !== undefined)(
  'SFL L0/L1 PostgreSQL concurrency', () => {
  let database: DatabasePool;
  let runtimeDatabase: DatabasePool;
  let appDatabase: DatabasePool;
  let operations: OperationUsecase;
  let managementOperations: OperationUsecase;
  let termsHash: string;

  beforeAll(async () => {
    database = concurrentPool(adminConnection!);
    await seedL1Storefront(database);
    runtimeDatabase = concurrentPool(runtimeConnection!);
    const storefront = await new MemberPort().storefrontRegistration(runtimeDatabase, nodes[1]!.application);
    expect(storefront?.organization_id).toBe(nodes[1]!.organization);
    operations = identityRegistrationOperations(context(runtimeDatabase));
    appDatabase = concurrentPool(appConnection!);
    managementOperations = identityOperations(context(appDatabase));
    const policy = await database.query<{ terms_hash: string }>(`select terms_hash from identity.registrationpolicy
      where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp())
      order by version desc limit 1`);
    termsHash = policy.rows[0]?.terms_hash ?? '';
    expect(termsHash).toMatch(/^[0-9a-f]{64}$/);
  });

  afterAll(async () => {
    await Promise.all([database?.end(), runtimeDatabase?.end(), appDatabase?.end()]);
  });

  it('keeps 100 users, same-phone realms, idempotency, challenge, invite and ticket races exact', async () => {
    const latency = new Map<string, number[]>();
    const users = Array.from({ length: 100 }, (_, index): UserFixture => ({
      subject: mobile(166, index),
      password: `Sfl95!User${index}Aa`,
      node: nodes[index < 50 ? 0 : 1]!,
      key: `bulk-${index}`,
    }));

    const registrations = await Promise.all(users.map((user) => measuredInvoke(
      operations,
      registrationRequest(user, termsHash, `sfl95:register:${user.key}`),
      latency,
      'registration',
    )));
    expectSuccesses(registrations, 201, 100, 'BULK_REGISTRATION');

    const authorizations = users.map((user) => authorization(`bulk-login:${user.key}`));
    const logins = await Promise.all(users.map((user, index) => measuredInvoke(
      operations,
      loginRequest(user, authorizations[index]!, `sfl95:login:${user.key}`),
      latency,
      'login',
    )));
    expectSuccesses(logins, 201, 100, 'BULK_LOGIN');
    const bulkEvidence = await identityEvidence(database, users);
    expect(bulkEvidence.accounts).toBe(100);
    expect(bulkEvidence.credentials).toBe(100);
    expect(bulkEvidence.memberships).toBe(100);
    expect(bulkEvidence.sessions).toBe(100);
    expect(bulkEvidence.realmCounts).toEqual({ 'realm:l0': 50, 'realm:l1': 50 });
    expect(bulkEvidence.duplicateAccounts).toBe(0);
    expect(bulkEvidence.duplicateSessions).toBe(0);
    expect(bulkEvidence.crossRealmWrites).toBe(0);

    const sharedSubject = mobile(177, 90);
    const realmUsers = nodes.map((realmNode, index): UserFixture => ({
      subject: sharedSubject,
      password: `Sfl95!Realm${index}DifferentAa`,
      node: realmNode,
      key: `shared-${realmNode.id}`,
    }));
    const realmRegistrations = await Promise.all(realmUsers.map((user) => measuredInvoke(
      operations,
      registrationRequest(user, termsHash, `sfl95:shared-register:${user.node.id}`),
      latency,
      'crossRealmRegistration',
    )));
    expectSuccesses(realmRegistrations, 201, 2, 'CROSS_REALM_REGISTRATION');
    const realmAuthorizations = realmUsers.map((user) => authorization(`shared-login:${user.node.id}`));
    const realmLogins = await Promise.all(realmUsers.map((user, index) => measuredInvoke(
      operations,
      loginRequest(user, realmAuthorizations[index]!, `sfl95:shared-login:${user.node.id}`),
      latency,
      'crossRealmLogin',
    )));
    expectSuccesses(realmLogins, 201, 2, 'CROSS_REALM_LOGIN');
    const wrongPasswords = await Promise.all(realmUsers.map((user, index) => measuredInvoke(
      operations,
      loginRequest({ ...user, password: realmUsers[1 - index]!.password }, authorization(`wrong:${user.node.id}`),
        `sfl95:wrong-password:${user.node.id}`),
      latency,
      'crossRealmWrongPassword',
    )));
    expectCodes(wrongPasswords, { CREDENTIAL_INVALID: 2 }, 'CROSS_REALM_PASSWORD');
    const realmEvidence = await identityEvidence(database, realmUsers);
    expect(realmEvidence.accounts).toBe(2);
    expect(realmEvidence.sessions).toBe(2);
    expect(realmEvidence.realmCounts).toEqual({ 'realm:l0': 1, 'realm:l1': 1 });
    expect(realmEvidence.duplicateAccounts).toBe(0);
    expect(realmEvidence.duplicateSessions).toBe(0);
    expect(realmEvidence.crossRealmWrites).toBe(0);

    const duplicateUser: UserFixture = {
      subject: mobile(188, 91), password: 'Sfl95!DuplicateRequestAa', node: nodes[0]!, key: 'duplicate-request',
    };
    const duplicateRequest = registrationRequest(duplicateUser, termsHash, 'sfl95:duplicate-request');
    const duplicateOutcomes = await Promise.all(Array.from({ length: 20 }, () => measuredInvoke(
      operations, duplicateRequest, latency, 'idempotencyRace',
    )));
    expectSuccesses(duplicateOutcomes, 201, 20, 'IDEMPOTENCY_RACE');
    const duplicateEvidence = await identityEvidence(database, [duplicateUser]);
    expect(duplicateEvidence.accounts).toBe(1);
    expect(duplicateEvidence.credentials).toBe(1);
    expect(duplicateEvidence.memberships).toBe(1);
    expect(Number((await database.query<{ count: string }>(
      `select count(*) count from runtime.idempotency where key='sfl95:duplicate-request' and state='completed'`,
    )).rows[0]?.count)).toBe(1);

    const resetUser: UserFixture = {
      subject: mobile(199, 92), password: 'Sfl95!ChallengeBeforeAa', node: nodes[0]!, key: 'challenge-race',
    };
    expectSuccesses([await measuredInvoke(operations,
      registrationRequest(resetUser, termsHash, 'sfl95:challenge-account'), latency, 'challengeSetup')], 201, 1, 'CHALLENGE_SETUP');
    const resetIdentity = await accountFor(database, resetUser);
    const challengeId = 'challenge:sfl95:competition';
    const challengeCode = '483921';
    await database.query(`insert into identity.challenge(
      id,principal_id,purpose,destination_hash,code_hash,attempts,expires_at,created_at,realm_id,account_id
    ) values($1,$2,'password_reset',$3,$4,0,clock_timestamp()+interval '10 minutes',clock_timestamp(),$5,$6)`, [
      challengeId, resetIdentity.principal, subjectDigest(resetUser.subject), challengeDigest(challengeId, challengeCode),
      resetUser.node.realm, resetIdentity.account,
    ]);
    const challengeOutcomes = await Promise.all(Array.from({ length: 20 }, (_, index) => measuredInvoke(
      operations,
      passwordResetRequest(resetUser.node, challengeId, challengeCode, `sfl95:challenge-race:${index}`),
      latency,
      'challengeRace',
    )));
    expectCodes(challengeOutcomes, { OK: 1, CHALLENGE_INVALID: 19 }, 'CHALLENGE_RACE');
    const challengeState = (await database.query<{ attempts: number; consumed: boolean; credential_version: number }>(
      `select challenge.attempts,challenge.consumed_at is not null consumed,account.credential_version::integer credential_version
      from identity.challenge challenge join identity.account account on account.id=challenge.account_id and account.realm_id=challenge.realm_id
      where challenge.id=$1`, [challengeId],
    )).rows[0];
    expect(challengeState).toEqual({ attempts: 1, consumed: true, credential_version: 2 });

    const invitationManager = await promoteInvitationManager(database, users[0]!);
    const invitation = await measuredInvoke(
      managementOperations, invitationRequest(invitationManager), latency, 'inviteSetup',
    );
    expectSuccesses([invitation], 201, 1, 'INVITE_SETUP');
    const inviteCode = String(body(invitation.result).code);
    const inviteId = String(body(invitation.result).id);
    const inviteCandidates = Array.from({ length: 20 }, (_, index): UserFixture => ({
      subject: mobile(155, 200 + index), password: `Sfl95!Invite${index}Aa`, node: nodes[0]!, key: `invite-${index}`,
    }));
    await seedRegistrationChallenges(database, inviteCandidates, inviteCode);
    const inviteOutcomes = await Promise.all(inviteCandidates.map((candidate, index) => measuredInvoke(
      operations,
      inviteRegistrationRequest(candidate, termsHash, inviteCode, index),
      latency,
      'inviteRace',
    )));
    expectCodes(inviteOutcomes, { OK: 1, INVITE_INVALID: 19 }, 'INVITE_RACE');
    const inviteState = (await database.query<{ use_count: number; consumed_challenges: number }>(
      `select invite.use_count,(select count(*)::integer from identity.challenge challenge
        where challenge.id like 'challenge:sfl95:invite:%' and challenge.consumed_at is not null) consumed_challenges
      from member.invite invite where invite.id=$1`, [inviteId],
    )).rows[0];
    expect(inviteState).toEqual({ use_count: 1, consumed_challenges: 1 });
    const inviteEvidence = await identityEvidence(database, inviteCandidates);
    expect(inviteEvidence.accounts).toBe(1);
    expect(inviteEvidence.credentials).toBe(1);
    expect(inviteEvidence.memberships).toBe(1);
    expect(inviteEvidence.crossRealmWrites).toBe(0);

    const ticketLogin = logins[0]!;
    const ticketBody = body(ticketLogin.result);
    const callback = record(ticketBody.callback, 'TICKET_CALLBACK_INVALID');
    const sessionToken = sessionCookie(ticketLogin.result);
    const sessionId = String(ticketBody.session);
    const sessionsBefore = await sessionCount(database, sessionId);
    const ticketOutcomes = await Promise.all(Array.from({ length: 20 }, (_, index) => measuredInvoke(
      operations,
      ticketExchangeRequest(users[0]!.node, sessionToken, {
        ticket: String(callback.ticket), state: String(callback.state), nonce: authorizations[0]!.nonce,
        verifier: authorizations[0]!.verifier,
      }, `sfl95:ticket-race:${index}`),
      latency,
      'ticketRace',
    )));
    expectCodes(ticketOutcomes, { OK: 1, AUTH_TICKET_EXCHANGE_REJECTED: 19 }, 'TICKET_RACE');
    expect(await sessionCount(database, sessionId)).toBe(sessionsBefore);
    const ticketState = await database.query<{ rows: number; consumed: number }>(
      `select count(*)::integer rows,count(consumed_at)::integer consumed from identity.authticket where token_hash=$1`,
      [sha256(String(callback.ticket))],
    );
    expect(ticketState.rows[0]).toEqual({ rows: 1, consumed: 1 });

    const finalDuplicateAccounts = await duplicateAccountCount(database);
    const finalDuplicateSessions = await duplicateSessionCount(database);
    const finalCrossRealmWrites = await crossRealmWriteCount(database);
    expect(finalDuplicateAccounts).toBe(0);
    expect(finalDuplicateSessions).toBe(0);
    expect(finalCrossRealmWrites).toBe(0);

    const report = {
      engine: 'PostgreSQL 17', users: 100, l0Users: 50, l1Users: 50,
      registrationSuccessRate: successRate(registrations, 201), loginSuccessRate: successRate(logins, 201),
      samePhoneAccounts: realmEvidence.accounts, samePhoneSessions: realmEvidence.sessions,
      duplicateAccounts: finalDuplicateAccounts, duplicateSessions: finalDuplicateSessions,
      crossRealmWrites: finalCrossRealmWrites,
      races: { idempotency: '20 cached/1 write', challenge: '1 success/19 rejected', invite: '1 success/19 rejected', ticket: '1 success/19 rejected' },
      latencyMs: Object.fromEntries([...latency.entries()].map(([name, values]) => [name, percentiles(values)])),
    };
    process.stdout.write(`SFL95_IDENTITY_CONCURRENCY ${JSON.stringify(report)}\n`);
  }, 300_000);
});

function context(pool: DatabasePool): ModuleContext {
  const container = new Container();
  const kms = {
    encrypt: async (_key: string, plaintext: string) => ({
      ciphertext: `fixture:v1:${sha256(plaintext)}`,
      fingerprint: sha256(plaintext),
      keyVersion: 'fixture-v1',
    }),
  } as unknown as KmsClient;
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
  container.bind(IDENTITY_SECURITY_KEYS, { identity: IDENTITY_KEY, session: SESSION_KEY });
  container.bind(KMS_CLIENT, kms);
  return { container } as unknown as ModuleContext;
}

function concurrentPool(connectionString: string): DatabasePool {
  const source = new Pool({ connectionString, max: 20, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000,
    statement_timeout: 120_000, application_name: 'sfl95-identity-concurrency' });
  const database: DatabasePool = {
    connect: () => source.connect(),
    query: <R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]) =>
      source.query<R>(text, values as unknown[] | undefined),
    workload: () => database,
    end: () => source.end(),
  };
  return database;
}

function registrationRequest(user: UserFixture, termsHash: string, idempotency: string): OperationRequest {
  return request('identity.members.create', user.node, idempotency, {
    subject: user.subject, password: user.password, displayName: `并发会员 ${user.key}`,
    application: user.node.application, target: user.node.target, termsAccepted: true, termsHash,
    phoneVerification: 'checkout',
  });
}

function inviteRegistrationRequest(user: UserFixture, termsHash: string, invite: string, index: number): OperationRequest {
  return request('identity.members.create', user.node, `sfl95:invite-register:${index}`, {
    subject: user.subject, password: user.password, displayName: `邀请竞争会员 ${index}`,
    invite, challenge: `challenge:sfl95:invite:${index}`, code: '593810', termsAccepted: true, termsHash,
  });
}

function loginRequest(user: UserFixture, authorizationValue: AuthorizationFixture, idempotency: string): OperationRequest {
  return request('identity.sessions.create', user.node, idempotency, {
    provider: 'password', subject: user.subject, password: user.password,
    target: user.node.target, application: user.node.application,
    authorization: { state: authorizationValue.state, nonce: authorizationValue.nonce, challenge: authorizationValue.challenge },
  });
}

function passwordResetRequest(nodeSpec: NodeSpec, challenge: string, code: string, idempotency: string): OperationRequest {
  return request('identity.password.reset', nodeSpec, idempotency, {
    challenge, code, newPassword: 'Sfl95!ChallengeAfterAa',
  });
}

function invitationRequest(access: AccessContext): OperationRequest {
  return request('identity.invitations.create', nodes[0]!, 'sfl95:invite-create', {
    label: 'SFL95 并发邀请', targetClient: 'storefront', maxUses: 1,
    expiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
  }, access);
}

function ticketExchangeRequest(nodeSpec: NodeSpec, session: string, value: Readonly<Record<string, unknown>>,
  idempotency: string): OperationRequest {
  return request('identity.tickets.exchange', nodeSpec, idempotency, value, null, { cookie: `shop_session=${session}` });
}

function request(type: OperationRequest['type'], nodeSpec: NodeSpec, idempotency: string, bodyValue: Readonly<Record<string, unknown>>,
  access: AccessContext | null = null, extraHeaders: Readonly<Record<string, string>> = {}): OperationRequest {
  return {
    type,
    access,
    input: {
      path: {}, query: {},
      headers: { host: nodeSpec.host, 'x-device-id': `sfl95:${idempotency}`.slice(0, 128), 'user-agent': 'sfl95-concurrency', ...extraHeaders },
      body: bodyValue, rawBody: JSON.stringify(bodyValue), deadline: Date.now() + 300_000,
      signal: new AbortController().signal, idempotency,
    },
  };
}

function invitationManagerAccess(manager: Readonly<{ membership: string; principal: string; accessVersion: number }>): AccessContext {
  const scope = { kind: 'mall' as const, id: nodes[0]!.organization, tenant: 'tenant-zhudatuan', path: [] };
  return {
    actor: { id: manager.principal, session: 'session:sfl95-invitation-manager', membership: manager.membership,
      credentialVersion: 1, accessVersion: manager.accessVersion, target: 'console', assurance: { level: 2 } },
    membership: { id: manager.membership, active: true, accessVersion: manager.accessVersion, denies: [], grants: [{
      scope, permissions: ['identity.invitation.manage'], effective: new Date(0).toISOString(), expires: null,
    }] },
    governance: { governanceLevel: 'senior_administrator', isExactOwner: false, actorMembershipId: manager.membership,
      actorPrincipalId: manager.principal, organizationId: nodes[0]!.organization,
      ownerMembershipId: 'membership-platform-owner-ethan-v1',
      scope: { kind: 'mall', semanticId: nodes[0]!.organization, storageId: nodes[0]!.organization },
      resolvedAt: new Date() },
    scope, accessVersion: 1, capabilities: ['identity.invitations.create'], assurance: { level: 2 }, trace: 'sfl95:invite-owner',
  };
}

async function measuredInvoke(operations: OperationUsecase, operationRequest: OperationRequest,
  latency: Map<string, number[]>, name: string): Promise<Outcome> {
  const started = performance.now();
  try {
    return { key: operationRequest.input.idempotency ?? 'missing', result: await operations.invoke(operationRequest),
      milliseconds: recordLatency(latency, name, started) };
  } catch (cause) {
    return { key: operationRequest.input.idempotency ?? 'missing', error: cause instanceof Error ? cause.message : String(cause),
      milliseconds: recordLatency(latency, name, started) };
  }
}

function recordLatency(latency: Map<string, number[]>, name: string, started: number): number {
  const milliseconds = performance.now() - started;
  const values = latency.get(name) ?? [];
  values.push(milliseconds);
  latency.set(name, values);
  return milliseconds;
}

function expectSuccesses(outcomes: readonly Outcome[], status: number, count: number, label: string): void {
  const failures = outcomes.filter((outcome) => outcome.result?.status !== status)
    .map((outcome) => `${outcome.key}:${outcome.error ?? `${outcome.result?.status}:${String(body(outcome.result).code ?? 'UNKNOWN')}`}`);
  expect(failures, label).toEqual([]);
  expect(outcomes).toHaveLength(count);
}

function expectCodes(outcomes: readonly Outcome[], expected: Readonly<Record<string, number>>, label: string): void {
  const counts = new Map<string, number>();
  for (const outcome of outcomes) {
    const code = outcome.result?.status !== undefined && outcome.result.status < 400
      ? 'OK'
      : outcome.error ?? String(body(outcome.result).code ?? `HTTP_${outcome.result?.status ?? 0}`);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  expect(Object.fromEntries([...counts.entries()].sort()), label).toEqual(expected);
}

async function seedRegistrationChallenges(database: DatabasePool, users: readonly UserFixture[], invite: string): Promise<void> {
  const inviteHash = subjectDigest(invite);
  await Promise.all(users.map((user, index) => {
    const id = `challenge:sfl95:invite:${index}`;
    const code = '593810';
    return database.query(`insert into identity.challenge(
      id,purpose,destination_hash,code_hash,attempts,expires_at,created_at,realm_id
    ) values($1,'registration',$2,$3,0,clock_timestamp()+interval '10 minutes',clock_timestamp(),$4)`, [
      id, subjectDigest(user.subject), challengeDigest(id, `${code}:${inviteHash}`), user.node.realm,
    ]);
  }));
}

async function seedL1Storefront(database: DatabasePool): Promise<void> {
  const l1 = nodes[1]!;
  await database.query(`insert into organization.organization(
    id,kind,parent_id,name,timezone,status,version,created_at,updated_at
  ) values($1,'mall','enterprise-zhudatuan','SFL95 L1 Mall','Asia/Shanghai','active',1,clock_timestamp(),clock_timestamp())
    on conflict(id) do update set status='active',updated_at=clock_timestamp()`, [l1.organization]);
  await database.query(`insert into organization.unitclosure(ancestor_id,descendant_id,depth) values
    ($1,$1,0),('enterprise-zhudatuan',$1,1),('tenant-zhudatuan',$1,2),('organization-platform-root',$1,3)
    on conflict(ancestor_id,descendant_id) do nothing`, [l1.organization]);
  await database.query(`insert into access.role(id,scope_id,name,status,version)
    values($1,$2,'商城会员','active',1)
    on conflict(id) do update set scope_id=excluded.scope_id,status='active',version=access.role.version+1`,
  [`role-zhudatuan-storefront-member:${l1.organization}`, l1.organization]);
  await database.query(`insert into access.rolepermission(role_id,permission_id,effect)
    select $1,permission_id,effect from access.rolepermission where role_id='role-zhudatuan-storefront-member'
    on conflict do nothing`, [`role-zhudatuan-storefront-member:${l1.organization}`]);
  const existing = await database.query<{ id: string }>(
    'select id from experience.application where public_slug=$1', [l1.application],
  );
  const poolId = 'pool:sfl95:l1';
  const applicationId = existing.rows[0]?.id ?? 'application:sfl95:l1';
  const versionId = 'version:sfl95:l1';
  await database.query(`insert into catalog.pool(id,scope_id,kind,name,status,version)
    values($1,$2,'private','SFL95 L1 Pool','active',1) on conflict(id) do nothing`, [poolId, l1.organization]);
  if (!existing.rows[0]) {
    await database.query(`insert into experience.application(
      id,scope_id,name,status,created_at,updated_at,version,code,public_slug
    ) values($1,$2,'SFL95 L1 Storefront','active',clock_timestamp(),clock_timestamp(),1,'SFL95_L1',$3)`,
    [applicationId, l1.organization, l1.application]);
  } else {
    await database.query("update experience.application set scope_id=$2,status='active',updated_at=clock_timestamp() where id=$1",
      [applicationId, l1.organization]);
  }
  await database.query(`insert into experience.version(
    id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,created_by,created_at
  ) select $1,$2,coalesce(max(sequence),0)+1,'2',$3::jsonb,$4,'valid','sfl95-concurrency',clock_timestamp()
    from experience.version where application_id=$2`, [
    versionId, applicationId,
    JSON.stringify({ version: 2, application: applicationId, pages: [{ id: 'home', path: '/', blocks: [] }] }),
    'c'.repeat(64),
  ]);
  await database.query('update experience.application set head_version_id=$2 where id=$1', [applicationId, versionId]);
  await database.query(`insert into experience.release(id,application_id,version_id,state,effective_at,published_by)
    values('release:sfl95:l1',$1,$2,'active',clock_timestamp(),'sfl95-concurrency')`, [applicationId, versionId]);
  const binding = await database.query('select application_id from experience.binding where domain=$1', [l1.application]);
  if (binding.rows[0]) {
    await database.query('update experience.binding set application_id=$2,mall_id=$3,pool_id=$4 where domain=$1',
      [l1.application, applicationId, l1.organization, poolId]);
  } else {
    await database.query(`insert into experience.binding(application_id,domain,mall_id,pool_id) values($1,$2,$3,$4)`,
      [applicationId, l1.application, l1.organization, poolId]);
  }
  const storefront = await new MemberPort().storefrontRegistration(database, l1.application);
  if (storefront?.organization_id !== l1.organization) throw new Error('SFL95_L1_STOREFRONT_FIXTURE_INVALID');
}

async function identityEvidence(database: DatabasePool, users: readonly UserFixture[]): Promise<Readonly<{
  accounts: number; credentials: number; memberships: number; sessions: number;
  realmCounts: Readonly<Record<string, number>>; duplicateAccounts: number; duplicateSessions: number; crossRealmWrites: number;
}>> {
  const hashes = users.map((user) => subjectDigest(user.subject));
  const rows = await database.query<{ subject_hash: string; credential_realm: string; account_realm: string;
    account_id: string; membership_id: string | null; membership_realm: string | null; session_id: string | null; session_realm: string | null }>(
    `select credential.subject_hash,credential.realm_id credential_realm,account.realm_id account_realm,account.id account_id,
      membership.id membership_id,membership.realm_id membership_realm,session.id session_id,session.realm_id session_realm
    from identity.credential credential join identity.account account
      on account.id=credential.account_id and account.realm_id=credential.realm_id
    left join access.membership membership on membership.account_id=account.id and membership.realm_id=account.realm_id
    left join identity.session session on session.account_id=account.id and session.realm_id=account.realm_id
      and session.device_label like 'sfl95:%'
    where credential.provider='password' and credential.subject_hash=any($1::text[])`, [hashes],
  );
  const accounts = new Set(rows.rows.map((row) => row.account_id));
  const memberships = new Set(rows.rows.flatMap((row) => row.membership_id === null ? [] : [row.membership_id]));
  const sessions = new Set(rows.rows.flatMap((row) => row.session_id === null ? [] : [row.session_id]));
  const realmCounts: Record<string, number> = {};
  for (const row of rows.rows) {
    if (!realmCounts[row.account_realm]) realmCounts[row.account_realm] = 0;
  }
  for (const account of accounts) {
    const realm = rows.rows.find((row) => row.account_id === account)!.account_realm;
    realmCounts[realm] = (realmCounts[realm] ?? 0) + 1;
  }
  const keys = new Map<string, Set<string>>();
  for (const row of rows.rows) {
    const key = `${row.credential_realm}:${row.subject_hash}`;
    const values = keys.get(key) ?? new Set<string>();
    values.add(row.account_id);
    keys.set(key, values);
  }
  const sessionCounts = new Map<string, number>();
  for (const row of rows.rows) {
    if (row.session_id !== null) sessionCounts.set(row.account_id, (sessionCounts.get(row.account_id) ?? 0) + 1);
  }
  return {
    accounts: accounts.size,
    credentials: new Set(rows.rows.map((row) => `${row.credential_realm}:${row.subject_hash}`)).size,
    memberships: memberships.size,
    sessions: sessions.size,
    realmCounts,
    duplicateAccounts: [...keys.values()].filter((value) => value.size > 1).length,
    duplicateSessions: [...sessionCounts.values()].filter((value) => value > 1).length,
    crossRealmWrites: rows.rows.filter((row) => row.credential_realm !== row.account_realm
      || row.membership_realm !== row.account_realm || (row.session_realm !== null && row.session_realm !== row.account_realm)).length,
  };
}

async function accountFor(database: DatabasePool, user: UserFixture): Promise<Readonly<{ account: string; principal: string }>> {
  const result = await database.query<{ account_id: string; legacy_principal_id: string }>(
    `select account.id account_id,account.legacy_principal_id from identity.credential credential
      join identity.account account on account.id=credential.account_id and account.realm_id=credential.realm_id
    where credential.provider='password' and credential.subject_hash=$1 and credential.realm_id=$2`,
    [subjectDigest(user.subject), user.node.realm],
  );
  const found = result.rows[0];
  if (!found) throw new Error('SFL95_ACCOUNT_NOT_FOUND');
  return { account: found.account_id, principal: found.legacy_principal_id };
}

async function promoteInvitationManager(database: DatabasePool, user: UserFixture): Promise<AccessContext> {
  const manager = (await database.query<{ membership: string; principal: string; access_version: string }>(
    `select membership.id membership,account.legacy_principal_id principal,membership.access_version
      from identity.credential credential join identity.account account
        on account.id=credential.account_id and account.realm_id=credential.realm_id
      join access.membership membership on membership.account_id=account.id and membership.realm_id=account.realm_id
    where credential.provider='password' and credential.subject_hash=$1 and credential.realm_id=$2
      and membership.organization_id=$3 and membership.client='storefront' and membership.status='active'`,
    [subjectDigest(user.subject), user.node.realm, user.node.organization],
  )).rows[0];
  if (!manager?.principal) throw new Error('SFL95_INVITATION_MANAGER_MISSING');
  const role = 'role:sfl95:invitation-manager';
  await database.query(`insert into access.role(id,scope_id,name,status,version)
    values($1,$2,'SFL95 Invitation Manager','active',1) on conflict(id) do nothing`, [role, user.node.organization]);
  await database.query(`insert into access.rolepermission(role_id,permission_id,effect)
    select $1,id,'allow' from access.permission where code='identity.invitation.manage' and status='active'
    on conflict do nothing`, [role]);
  await database.query(`insert into access.membershiprole(membership_id,role_id,effective_at)
    values($1,$2,clock_timestamp()-interval '1 second')`, [manager.membership, role]);
  return invitationManagerAccess({ membership: manager.membership, principal: manager.principal,
    accessVersion: Number(manager.access_version) });
}

async function sessionCount(database: DatabasePool, id: string): Promise<number> {
  return Number((await database.query<{ count: string }>('select count(*) count from identity.session where id=$1', [id])).rows[0]?.count);
}

async function duplicateAccountCount(database: DatabasePool): Promise<number> {
  return Number((await database.query<{ count: string }>(`select count(*) count from (
    select credential.realm_id,credential.subject_hash from identity.credential credential
    where credential.provider='password' and credential.id like 'credential:%'
    group by credential.realm_id,credential.subject_hash having count(*)>1) duplicate`)).rows[0]?.count);
}

async function duplicateSessionCount(database: DatabasePool): Promise<number> {
  return Number((await database.query<{ count: string }>(`select count(*) count from (
    select account_id from identity.session where device_label like 'sfl95:%'
    group by account_id having count(*)>1) duplicate`)).rows[0]?.count);
}

async function crossRealmWriteCount(database: DatabasePool): Promise<number> {
  return Number((await database.query<{ count: string }>(`select
    (select count(*) from identity.credential credential join identity.account account on account.id=credential.account_id
      where credential.id like 'credential:%' and credential.realm_id<>account.realm_id)
    +(select count(*) from access.membership membership join identity.account account on account.id=membership.account_id
      where membership.id like 'membership:%' and membership.realm_id<>account.realm_id)
    +(select count(*) from identity.session session join identity.account account on account.id=session.account_id
      where session.device_label like 'sfl95:%' and session.realm_id<>account.realm_id) count`)).rows[0]?.count);
}

function node(id: string): NodeSpec {
  const manifestNode = IDENTITY_NODE_MANIFEST.nodes.find((candidate) => candidate.nodeId === id);
  if (!manifestNode) throw new Error(`SFL95_NODE_MISSING:${id}`);
  return nodeSpec(manifestNode);
}

function nodeSpec(manifestNode: IdentityNodeManifestNode): NodeSpec {
  const entry = manifestNode.entries.find((candidate) => candidate.kind === 'api' && candidate.status === 'active');
  const target = manifestNode.targets.find((candidate) => candidate.surface === 'consumer');
  if (!entry || !target?.application) throw new Error(`SFL95_NODE_CONSUMER_INVALID:${manifestNode.nodeId}`);
  return { id: manifestNode.nodeId, realm: manifestNode.realmId, host: entry.host, target: target.target,
    application: target.application, organization: target.membershipOrganizationId };
}

function authorization(seed: string): AuthorizationFixture {
  const verifier = hashToken(`${seed}:verifier`);
  return {
    state: hashToken(`${seed}:state`),
    nonce: hashToken(`${seed}:nonce`),
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  };
}

function mobile(prefix: number, index: number): string {
  return `+86${prefix}${String(index).padStart(8, '0')}`;
}

function subjectDigest(value: string): string {
  return createHmac('sha256', IDENTITY_KEY).update(value.trim().toLowerCase()).digest('hex');
}

function challengeDigest(challenge: string, code: string): string {
  return createHmac('sha256', SESSION_KEY).update(`${challenge}:${code}`).digest('hex');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function body(result: OperationResult | undefined): Readonly<Record<string, unknown>> {
  return result?.body !== null && typeof result?.body === 'object' && !Array.isArray(result.body)
    ? result.body as Readonly<Record<string, unknown>> : {};
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function sessionCookie(result: OperationResult | undefined): string {
  const cookie = result?.headers?.['set-cookie'];
  const token = typeof cookie === 'string' ? /(?:^|;\s*)shop_session=([^;]+)/.exec(cookie)?.[1] : undefined;
  if (!token) throw new Error('SFL95_SESSION_COOKIE_MISSING');
  return token;
}

function successRate(outcomes: readonly Outcome[], status: number): number {
  return Number(((outcomes.filter((outcome) => outcome.result?.status === status).length / outcomes.length) * 100).toFixed(2));
}

function percentiles(values: readonly number[]): Readonly<{ p50: number; p95: number; p99: number }> {
  const sorted = [...values].sort((left, right) => left - right);
  const at = (percentile: number) => Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentile) - 1)]!.toFixed(2));
  return { p50: at(0.5), p95: at(0.95), p99: at(0.99) };
}
