import { createHash, createHmac, randomUUID } from 'node:crypto';
import { Pool, type QueryResultRow } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Container } from '../../src/bootstrap/Container';
import type { ModuleContext } from '../../src/bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../src/foundation/application/AuditSink';
import type { OperationRequest, OperationResult, OperationUsecase } from '../../src/foundation/application/OperationHandler';
import { KMS_CLIENT, type KmsClient } from '../../src/foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS } from '../../src/foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../src/foundation/persistence/Pool';
import { PasswordPolicy } from '../../src/modules/identity/02_domain_yewu/policies_guize/PasswordPolicy';
import { identityRegistrationOperations } from '../../src/modules/identity/05_interface_jieru/http/IdentityOperations';

const adminConnection = process.env.SHOP_TEST_ADMIN_DATABASE_URL;
const identityConnection = process.env.SHOP_TEST_DATABASE_URL;
const rounds = Number(process.env.SHOP_TEST_STABILITY_ROUNDS ?? '1');
const IDENTITY_KEY = 'stability-identity-key';
const SESSION_KEY = 'stability-session-key';

describe.runIf(adminConnection !== undefined && identityConnection !== undefined)('password login PostgreSQL stability', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const subject = `+86139${suffix.replace(/[^0-9]/g, '').padEnd(8, '7').slice(0, 8)}`;
  const password = `Stability${suffix.slice(0, 12)}Aa`;
  const principal = `principal:stability:${suffix}`;
  const account = `account:stability:${suffix}`;
  const member = `member:stability:${suffix}`;
  const membership = `membership:stability:${suffix}`;
  let admin: DatabasePool;
  let identity: DatabasePool;
  let operations: OperationUsecase;

  beforeAll(async () => {
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 1_000) throw new Error('STABILITY_ROUNDS_INVALID');
    admin = pool(adminConnection!);
    identity = pool(identityConnection!);
    await seedIdentity(admin, { suffix, subject, password, principal, account, member, membership });
    operations = identityRegistrationOperations(context(identity));
  });

  afterAll(async () => {
    await Promise.all([admin?.end(), identity?.end()]);
  });

  it(`logs in with a real password and exchanges a one-time ticket ${rounds} times`, async () => {
    const started = performance.now();
    for (let index = 0; index < rounds; index += 1) {
      const authorization = auth(`stability:${suffix}:${index}`);
      const login = await operations.invoke(request('identity.sessions.create', `login:${suffix}:${index}`, {
        provider: 'password', subject, password, target: 'storefront', application: 'zhudatuan-storefront',
        authorization: { state: authorization.state, nonce: authorization.nonce, challenge: authorization.challenge },
      }));
      expect(login).toMatchObject({ status: 201, body: { membership, target: 'storefront' } });
      const callback = record(record(login.body).callback);
      const exchanged = await operations.invoke(request('identity.tickets.exchange', `exchange:${suffix}:${index}`, {
        ticket: String(callback.ticket), state: String(callback.state), nonce: authorization.nonce,
        verifier: authorization.verifier,
      }, { cookie: `shop_session=${sessionCookie(login)}` }));
      expect(exchanged.status).toBe(200);
    }
    await expect(operations.invoke(request('identity.sessions.create', `wrong:${suffix}`, {
      provider: 'password', subject, password: `${password}wrong`, target: 'storefront', application: 'zhudatuan-storefront',
      authorization: auth(`wrong:${suffix}`),
    }))).resolves.toMatchObject({ status: 401, body: { code: 'CREDENTIAL_INVALID' } });
    const evidence = (await admin.query<{ sessions: number; tickets: number }>(`select
      (select count(*)::integer from identity.session where account_id=$1 and device_label like 'stability:%') sessions,
      (select count(*)::integer from identity.authticket where account_id=$1 and consumed_at is not null) tickets`, [account])).rows[0];
    expect(evidence).toEqual({ sessions: rounds, tickets: rounds });
    process.stdout.write(`PASSWORD_LOGIN_STABILITY ${JSON.stringify({ rounds, failures: 0,
      milliseconds: Math.round(performance.now() - started) })}\n`);
  }, 300_000);
});

function context(database: DatabasePool): ModuleContext {
  const container = new Container();
  const kms = { encrypt: async (_key: string, plaintext: string) => ({
    ciphertext: `fixture:v1:${sha256(plaintext)}`, fingerprint: sha256(plaintext), keyVersion: 'fixture-v1',
  }) } as unknown as KmsClient;
  container.bind(DATABASE_POOL, database);
  container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
  container.bind(IDENTITY_SECURITY_KEYS, { identity: IDENTITY_KEY, session: SESSION_KEY });
  container.bind(KMS_CLIENT, kms);
  return { container } as unknown as ModuleContext;
}

function pool(connectionString: string): DatabasePool {
  const source = new Pool({ connectionString, max: 20, connectionTimeoutMillis: 10_000,
    statement_timeout: 120_000, application_name: 'password-login-stability' });
  const database: DatabasePool = {
    connect: () => source.connect(),
    query: <R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]) =>
      source.query<R>(text, values as unknown[] | undefined),
    workload: () => database,
    end: () => source.end(),
  };
  return database;
}

async function seedIdentity(database: DatabasePool, fixture: Readonly<{ suffix: string; subject: string; password: string;
  principal: string; account: string; member: string; membership: string }>): Promise<void> {
  const subjectHash = createHmac('sha256', IDENTITY_KEY).update(fixture.subject.toLowerCase()).digest('hex');
  const passwordHash = await new PasswordPolicy().hash(fixture.password);
  await database.query(`insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values($1,'active',1,clock_timestamp(),clock_timestamp(),0)`, [fixture.principal]);
  await database.query(`insert into identity.account(id,realm_id,legacy_principal_id,status,credential_version,assurance_level,
    mobile_ciphertext,mobile_token,mobile_masked,phone_verified_at,created_at,updated_at,version)
    values($1,'realm:l0',$2,'active',1,2,'cipher:stability',$3,'139****0000',clock_timestamp(),clock_timestamp(),clock_timestamp(),0)`,
  [fixture.account, fixture.principal, subjectHash]);
  await database.query(`insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id)
    values($1,$2,'password',$3,$4,'active',clock_timestamp(),'realm:l0',$5)`,
  [`credential:stability:${fixture.suffix}`, fixture.principal, subjectHash, passwordHash, fixture.account]);
  await database.query(`insert into member.profile(id,principal_id,display_name,status,mobile_ciphertext,mobile_token,mobile_masked,created_at,updated_at,version)
    values($1,$2,'稳定性测试会员','active','cipher:stability',$3,'139****0000',clock_timestamp(),clock_timestamp(),0)`,
  [fixture.member, fixture.principal, subjectHash]);
  await database.query(`insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at,
    realm_id,account_id,node_profile)
    values($1,$2,'mall-zhudatuan','storefront','active',1,clock_timestamp(),'realm:l0',$3,'operating_mall')`,
  [fixture.membership, fixture.member, fixture.account]);
  await database.query(`insert into access.membershiprole(membership_id,role_id,effective_at) values
    ($1,'role-zhudatuan-storefront-member',clock_timestamp()),($1,'role:self',clock_timestamp())`, [fixture.membership]);
  await database.query(`insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
    ($1,$2,'mall','mall-zhudatuan','mall-zhudatuan','allow',clock_timestamp(),1),
    ($3,$2,'owner',$4,$4,'allow',clock_timestamp(),1),
    ($5,$2,'self',$6,$6,'allow',clock_timestamp(),1)`,
  [`scope:stability:mall:${fixture.suffix}`, fixture.membership, `scope:stability:owner:${fixture.suffix}`, fixture.member,
    `scope:stability:self:${fixture.suffix}`, `self:${fixture.principal}`]);
}

function request(type: OperationRequest['type'], idempotency: string, body: Readonly<Record<string, unknown>>,
  headers: Readonly<Record<string, string>> = {}): OperationRequest {
  return { type, access: null, input: { path: {}, query: {}, headers: {
    host: 'api.fufu.wang', 'x-device-id': `stability:${idempotency}`.slice(0, 128),
    'user-agent': 'password-login-stability', ...headers,
  }, body, rawBody: JSON.stringify(body), deadline: Date.now() + 300_000,
  signal: new AbortController().signal, idempotency } };
}

function auth(seed: string): Readonly<{ state: string; nonce: string; verifier: string; challenge: string }> {
  const verifier = token(`${seed}:verifier`);
  return { state: token(`${seed}:state`), nonce: token(`${seed}:nonce`), verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url') };
}

function token(value: string): string { return createHash('sha256').update(value).digest('base64url'); }
function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('RECORD_INVALID');
  return value as Record<string, unknown>;
}

function sessionCookie(result: OperationResult): string {
  const cookie = result.headers?.['set-cookie'];
  const tokenValue = typeof cookie === 'string' ? /(?:^|;\s*)shop_session=([^;]+)/.exec(cookie)?.[1] : undefined;
  if (!tokenValue) throw new Error('SESSION_COOKIE_MISSING');
  return tokenValue;
}
