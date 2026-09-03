import { createHash, randomUUID } from 'node:crypto';
import { Client, Pool, type QueryResult, type QueryResultRow } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabasePool } from '../../src/foundation/persistence/Pool';
import type { TransactionOptions } from '../../src/foundation/persistence/TransactionManager';
import { PgTransactionManager } from '../../src/adapter/database/PgTransactionManager';
import { DomainError } from '../../src/foundation/domain/DomainError';
import { PgEmployeeAccessRepository } from '../../src/modules/access/infrastructure/persistence/PgEmployeeAccessRepository';
import { MemberPort } from '../../src/modules/member/infrastructure/persistence/MemberPort';
import { PgAuthTicket } from '../../src/modules/identity/infrastructure/persistence/PgAuthTicket';
import { PgChallenge } from '../../src/modules/identity/infrastructure/persistence/PgChallenge';
import { PgEnrollmentRepository } from '../../src/modules/identity/infrastructure/persistence/PgEnrollmentRepository';
import { PgInvitationRepository } from '../../src/modules/identity/infrastructure/persistence/PgInvitationRepository';
import { PgMembershipSelection } from '../../src/modules/identity/infrastructure/persistence/PgMembershipSelection';

const connection = process.env.SHOP_TEST_DATABASE_URL;
const endpointAvailable = connection !== undefined || process.env.PGHOST !== undefined;
const suffix = randomUUID();
const prefix = `identity-concurrency:${suffix}`;
const organization = 'mall-zhudatuan';
const issuerPrincipal = `${prefix}:issuer:principal`;
const issuerMember = `${prefix}:issuer:member`;
const issuerMembership = `${prefix}:issuer:membership`;
const registrationPolicy = `${prefix}:policy`;
const registrationVersion = 1_500_000_000 + Number.parseInt(suffix.slice(0, 6), 16);
const termsHash = hash('terms');
const admin = new Client(databaseConfiguration());
const pool = integrationPool();
const transactions = new PgTransactionManager(pool);

describe.runIf(endpointAvailable)('Identity single-consumption concurrency', () => {
  beforeAll(async () => {
    await admin.connect();
    await admin.query(
      `insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
      values($1,'active',1,clock_timestamp(),clock_timestamp(),1)`,
      [issuerPrincipal]
    );
    await admin.query(
      `insert into member.profile(id,principal_id,display_name,status,mobile_masked,created_at,updated_at,version)
      values($1,$2,'并发验收签发人','active','***',clock_timestamp(),clock_timestamp(),1)`,
      [issuerMember, issuerPrincipal]
    );
    await admin.query(
      `insert into access.membership(id,member_id,principal_id,organization_id,client,status,access_version,joined_at)
      values($1,$2,$3,$4,'storefront','active',1,clock_timestamp())`,
      [issuerMembership, issuerMember, issuerPrincipal, organization]
    );
    await admin.query(
      `insert into identity.registrationpolicy(id,version,terms_version,terms_title,terms_body,privacy_title,privacy_body,
      terms_hash,effective_at) values($1,$2,$3,'并发验收协议','协议正文','并发验收隐私政策','隐私正文',$4,clock_timestamp())`,
      [registrationPolicy, registrationVersion, `concurrency-${suffix}`, termsHash]
    );
  });

  afterAll(async () => {
    await admin.query("delete from runtime.outbox where trace_id like $1 or aggregate_id like $1", [`${prefix}%`]).catch(() => undefined);
    await admin.query(
      `delete from identity.preauth preauth using identity.invitationclaim claim
      where preauth.reference_id=claim.id::text and claim.invitation_id like $1`,
      [`${prefix}%`]
    ).catch(() => undefined);
    await admin.query("delete from identity.preauth where reference_id like $1 or principal_id like $1", [`${prefix}%`]).catch(() => undefined);
    await admin.query("delete from identity.invitationclaim where invitation_id like $1", [`${prefix}%`]).catch(() => undefined);
    await admin.query("delete from identity.invitation where id like $1", [`${prefix}%`]).catch(() => undefined);
    await admin.query('delete from identity.registrationpolicy where id=$1', [registrationPolicy]).catch(() => undefined);
    await admin.query("delete from identity.challenge where id like $1", [`${prefix}%`]).catch(() => undefined);
    await admin.query("delete from identity.session where id like $1", [`${prefix}%`]).catch(() => undefined);
    await admin.query("delete from access.scopegrant where membership_id like $1", [`${prefix}%`]).catch(() => undefined);
    await admin.query("delete from access.membershiprole where membership_id like $1", [`${prefix}%`]).catch(() => undefined);
    await admin.query("delete from access.membership where id like $1", [`${prefix}%`]).catch(() => undefined);
    await admin.query("delete from member.profile where id like $1", [`${prefix}%`]).catch(() => undefined);
    await admin.query("delete from identity.credential where principal_id like $1", [`${prefix}%`]).catch(() => undefined);
    await admin.query("delete from identity.principal where id like $1", [`${prefix}%`]).catch(() => undefined);
    await Promise.allSettled([pool.end(), admin.end()]);
  });

  it('consumes one challenge exactly once under concurrent requests', async () => {
    const challenge = `${prefix}:challenge`;
    const codeHash = hash('challenge:123456');
    await admin.query(
      `insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,attempts,expires_at,created_at)
      values($1,$2,'login',$3,$4,0,clock_timestamp()+interval '5 minutes',clock_timestamp())`,
      [challenge, issuerPrincipal, hash('destination'), codeHash]
    );
    const repository = new PgChallenge();
    const consume = (request: string) => transactions.write(options('identity.sessions.create', request), (context) => repository.consume(context, challenge, '123456', () => codeHash, issuerPrincipal, { purpose: 'login' }));

    await expectExactlyOne([consume('challenge-one'), consume('challenge-two')]);
    const state = await admin.query<{ consumed: boolean }>('select consumed_at is not null consumed from identity.challenge where id=$1', [challenge]);
    expect(state.rows[0]?.consumed).toBe(true);
  });

  it('exchanges one ticket exactly once and rotates the session atomically', async () => {
    const session = `${prefix}:ticket:session`;
    const sessionToken = 'x'.repeat(64);
    await admin.query(
      `insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,
      ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
      values($1,$2,$3,$4,1,1,'storefront',$5,'concurrency-test','concurrency-test',1,
      clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp())`,
      [session, issuerPrincipal, issuerMembership, hash(sessionToken), hash('peer')]
    );
    const state = 's'.repeat(32);
    const nonce = 'n'.repeat(32);
    const verifier = 'v'.repeat(64);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const repository = new PgAuthTicket();
    const issued = await transactions.write(options('identity.sessions.create', 'ticket-issue'), (context) => repository.issueBound(context, session, 'storefront', { stateHash: hash(state), nonceHash: hash(nonce), challenge }));
    const exchange = (request: string, next: string) => transactions.write(options('identity.tickets.exchange', request), (context) => repository.consume(context, { ticket: issued.ticket, state, nonce, verifier }, [sessionToken], next));

    await expectExactlyOne([exchange('ticket-one', 'a'.repeat(64)), exchange('ticket-two', 'b'.repeat(64))]);
    const stateAfter = await admin.query<{ consumed: number }>('select count(*)::int consumed from identity.authticket where session_id=$1 and consumed_at is not null', [session]);
    expect(stateAfter.rows[0]?.consumed).toBe(1);
  });

  it('never reserves invitation capacity above max uses', async () => {
    const invitation = `${prefix}:invitation`;
    const repository = new PgInvitationRepository();
    await transactions.write(options('identity.invitations.create', 'invitation-create'), (context) => repository.create(context, {
      id: invitation,
      kind: 'campaign',
      target: 'storefront',
      organization,
      membership: null,
      principal: null,
      recipientHash: null,
      token: { hash: Buffer.alloc(32, 7), version: `concurrency.${suffix}` },
      issuer: issuerMembership,
      issuerAccessVersion: 1,
      grantDigest: hash('grant'),
      assurance: 1,
      maxUses: 1,
      expiresAt: new Date(Date.now() + 60_000),
      policy: registrationPolicy,
      termsHash,
      reason: '验证并发邀请码容量不会超额',
    }));
    const locked = await transactions.read(options('identity.invitations.resolve', 'invitation-read'), (context) => repository.find(context, [{ hash: Buffer.alloc(32, 7), version: `concurrency.${suffix}` }], 'storefront'));
    const reserve = (request: string, fill: number) => transactions.write(options('identity.invitations.resolve', request), (context) => repository.reserve(context, locked, {
      claim: randomUUID(),
      preauth: createHash('sha256').update(`${prefix}:preauth:${fill}`).digest(),
      browser: Buffer.alloc(32, fill + 2),
      device: Buffer.alloc(32, fill + 4),
      recipient: null,
      principal: null,
      proof: 'terms',
      state: 'reserved',
      authorization: { stateHash: hash(`state:${fill}`), nonceHash: hash(`nonce:${fill}`), challenge: 'c'.repeat(43) },
      returnTarget: `${prefix}:return`,
    }));

    await expectExactlyOne([reserve('invitation-one', 11), reserve('invitation-two', 21)]);
    const claims = await admin.query<{ count: number }>("select count(*)::int count from identity.invitationclaim where invitation_id=$1 and state in('reserved','proofpending','proved')", [invitation]);
    expect(claims.rows[0]?.count).toBe(1);
  });

  it('consumes one membership selection exactly once', async () => {
    const repository = new PgMembershipSelection();
    const browser = Buffer.alloc(32, 31);
    const device = Buffer.alloc(32, 32);
    const memberships = [candidate(issuerMembership, '验收身份一'), candidate(`${prefix}:candidate`, '验收身份二')];
    const created = await transactions.write(options('identity.federations.callback', 'selection-create'), (context) => repository.create(context, {
      principal: issuerPrincipal,
      target: 'storefront',
      memberships,
      returnTarget: `${prefix}:return`,
      authorization: { stateHash: hash('selection-state'), nonceHash: hash('selection-nonce'), challenge: 'd'.repeat(43) },
      assurance: 1,
      browser,
      device,
    }));
    const consume = (request: string) => transactions.write(options('identity.federations.complete', request), (context) => repository.consume(context, created.id, browser, device, issuerMembership));

    await expectExactlyOne([consume('selection-one'), consume('selection-two')]);
    const state = await admin.query<{ consumed: number }>("select count(*)::int consumed from identity.preauth where id=$1::uuid and state='consumed'", [created.id]);
    expect(state.rows[0]?.consumed).toBe(1);
  });

  it('serializes enrollment identity creation and creates one principal, member and membership', async () => {
    const enrollments = new PgEnrollmentRepository();
    const members = new MemberPort();
    const access = new PgEmployeeAccessRepository();
    const subjectHash = hash(`${prefix}:subject`);
    const mobileHash = hash(`${prefix}:mobile`);
    const employee = `employee-${suffix}`;
    const enroll = (request: string) => transactions.write(options('identity.enrollments.complete', request), async (context) => {
      await members.lockMobile(context, mobileHash);
      const existing = await enrollments.findPrincipal(context, subjectHash);
      const mobileOwner = await members.mobileOwner(context, mobileHash);
      if (existing !== null || mobileOwner !== null) throw new DomainError('IDENTITY_ALREADY_EXISTS');
      const principal = `${prefix}:${request}:principal`;
      const member = `${prefix}:${request}:member`;
      const membership = `${prefix}:${request}:membership`;
      await enrollments.createPendingPrincipal(context, { principal, createdAt: new Date() });
      await members.createPending(context, { member, principal, display: '并发注册员工', mobileCiphertext: 'ciphertext', mobileFingerprint: mobileHash, mobileMasked: '138****0000' });
      await access.createStorefrontMembership(context, { membership, member, principal, organization, issuer: issuerMembership, issuerAccessVersion: 1, employeeNo: employee, department: null });
      return Object.freeze({ principal, member, membership });
    });

    await expectExactlyOne([enroll('enrollment-one'), enroll('enrollment-two')]);
    const counts = await admin.query<{ principals: number; members: number; memberships: number }>(
      `select
      (select count(*)::int from identity.principal where id like $1) principals,
      (select count(*)::int from member.profile where id like $1) members,
      (select count(*)::int from access.membership where id like $1) memberships`,
      [`${prefix}:enrollment-%`]
    );
    expect(counts.rows[0]).toEqual({ principals: 1, members: 1, memberships: 1 });
  });
});

function options(operation: string, request: string): TransactionOptions {
  return Object.freeze({
    tenant: organization,
    membership: issuerMembership,
    scope: organization,
    actor: issuerPrincipal,
    trace: `${prefix}:${request}`,
    operation,
    deadline: Date.now() + 15_000,
    signal: new AbortController().signal,
  });
}

function candidate(id: string, displayName: string) {
  return Object.freeze({ id, target: 'storefront' as const, accessVersion: 1, displayName, organizationName: '猪肚团福利商城', scopeKind: 'mall', scopeId: organization, roleLabel: '员工', logoUrl: null });
}

async function expectExactlyOne(operations: readonly Promise<unknown>[]): Promise<void> {
  const results = await Promise.allSettled(operations);
  expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
}

function databaseConfiguration() {
  return { ...(connection === undefined ? {} : { connectionString: connection }), connectionTimeoutMillis: 5_000, statement_timeout: 20_000 };
}

function integrationPool(): DatabasePool {
  const postgres = new Pool({ ...databaseConfiguration(), max: 8 });
  const database: DatabasePool = {
    connect: () => postgres.connect(),
    query: <R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>> => postgres.query<R>(text, values as unknown[] | undefined),
    workload: () => database,
    end: () => postgres.end(),
  };
  return database;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
