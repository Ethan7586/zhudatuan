import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapApi } from '../../src/bootstrap/ApiBootstrap';
import { ExtensionRegistry } from '../../src/bootstrap/ExtensionRegistry';
import { assertMallProvisioningRuntimeCompatibility } from '../../src/bootstrap/MallProvisioningApiRuntime';
import { AUDIT_SINK } from '../../src/foundation/application/AuditSink';
import type { TransactionContext } from '../../src/foundation/application/UnitOfWork';
import { PgUnitOfWork } from '../../src/foundation/infrastructure/PgUnitOfWork';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS } from '../../src/foundation/interface/OperationController';
import { DATABASE_POOL, createPool, type DatabasePool } from '../../src/foundation/persistence/Pool';
import type { AccessContext } from '../../src/foundation/security/AccessContext';
import { commerceTelemetry } from '../../src/foundation/telemetry/Telemetry';
import { MallProvisioningModule } from '../../src/modules/provisioning/MallProvisioningModule';
import { MALL_PROVISIONING_OPERATION_IDS } from '../../src/modules/provisioning/ProvisioningOperations';
import { CreateMall, type CreatedMall, type MallProvisioningPlan } from '../../src/modules/provisioning/application/CreateMall';
import { AUTONODE_CONTROL_CLIENT } from '../../src/modules/provisioning/04_adapters_shixian/AutoNodeControlClient';

const runtimeConnection = process.env.SHOP_TEST_DATABASE_URL;
const adminConnection = process.env.SHOP_TEST_ADMIN_DATABASE_URL;
const endpointAvailable = runtimeConnection !== undefined && adminConnection !== undefined;

describe.runIf(endpointAvailable)('L0 owner creates an L1 Mall Core through formal provisioning', () => {
  const testBatchId = `prov001:${randomUUID()}`;
  const fixture = fixtureIdentity(testBatchId);
  const plans: MallProvisioningPlan[] = [];
  let admin: Client;
  let pool: DatabasePool;
  let app: Awaited<ReturnType<typeof bootstrapApi>>['app'];

  beforeAll(async () => {
    admin = new Client({ connectionString: adminConnection, connectionTimeoutMillis: 5_000, statement_timeout: 20_000 });
    await admin.connect();
    await seedTestL0Owner(admin, fixture);
    pool = createPool(runtimeConnection!, 'api');
    await assertMallProvisioningRuntimeCompatibility(pool);
    const bootstrapped = await bootstrapApi({
      modules: [MallProvisioningModule],
      operationIds: MALL_PROVISIONING_OPERATION_IDS,
      extensions: new ExtensionRegistry({ verify: async () => false }),
      allowedOrigins: [],
      telemetry: commerceTelemetry(),
      configure(container) {
        container.bind(OPERATION_HANDLERS, new Map());
        container.bind(OPERATION_AUTHORIZER, { authorize: async () => ownerAccess(fixture) });
        container.bind(DATABASE_POOL, pool);
        container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
        container.bind(AUTONODE_CONTROL_CLIENT, {
          submitMall: async (mall) => taskReceipt(mall.mallId),
          read: async (taskId) => taskReceipt(taskId.replace(/^task:/, '')),
          retry: async (taskId) => taskReceipt(taskId.replace(/^task:/, '')),
        });
      },
    });
    app = bootstrapped.app;
  });

  afterAll(async () => {
    await pool?.end();
    if (!admin) return;
    await cleanupTestBatch(admin, fixture, plans);
    const baseline = await admin.query('select 1 from organization.organization where id=$1', [fixture.baseline]);
    expect(baseline.rowCount).toBe(1);
    await admin.query('delete from organization.organization where id=$1', [fixture.baseline]);
    await admin.end();
  });

  it('runs createL1MallFixture, idempotency, ownership, independence, rollback, and exact cleanup evidence', async () => {
    const provisioned = await createL1MallFixture(app, fixture);
    plans.push(provisioned.plan);
    expect(provisioned.created).toMatchObject({
      organizationId: provisioned.plan.mall,
      scopeId: provisioned.plan.mall,
      mallId: provisioned.plan.mall,
      parentId: fixture.l0,
      ownerMembershipId: provisioned.plan.ownerMembership,
      ownerMemberId: fixture.member,
      ownerPrincipalId: fixture.principal,
      name: '宏泰甄选',
      state: 'ready',
      publicationState: 'draft',
    });

    const facts = (await admin.query<{
      organization_id: string;
      scope_id: string;
      mall_id: string;
      parent_id: string;
      owner_membership_id: string;
      owner_member_id: string;
      owner_principal_id: string;
      credentials: number;
      organizations: number;
      pools: number;
      pool_bindings: number;
      applications: number;
      versions: number;
      application_bindings: number;
      memberships: number;
      owner_records: number;
      storefront_roles: number;
      storefront_permissions: number;
      idempotency_records: number;
    }>(`select owner.organization_id,owner.scope_id,owner.mall_id,mall.parent_id,
        owner.membership_id owner_membership_id,membership.member_id owner_member_id,
        profile.principal_id owner_principal_id,
        (select count(*)::integer from identity.credential where principal_id=profile.principal_id) credentials,
        (select count(*)::integer from organization.organization where id=owner.organization_id) organizations,
        (select count(*)::integer from catalog.pool where id=$2 and scope_id=owner.scope_id) pools,
        (select count(*)::integer from catalog.poolbinding where mall_id=owner.mall_id and pool_id=$2) pool_bindings,
        (select count(*)::integer from experience.application where id=$3 and scope_id=owner.scope_id) applications,
        (select count(*)::integer from experience.version where id=$4 and application_id=$3) versions,
        (select count(*)::integer from experience.binding where application_id=$3 and mall_id=owner.mall_id) application_bindings,
        (select count(*)::integer from access.membership where id=owner.membership_id
          and member_id=profile.id and organization_id=owner.organization_id and client='operator') memberships,
        (select count(*)::integer from access.mallowner where mall_id=owner.mall_id) owner_records,
        (select count(*)::integer from access.role where id='role-zhudatuan-storefront-member:'||owner.organization_id
          and scope_id=owner.organization_id and status='active') storefront_roles,
        (select count(*)::integer from access.rolepermission mapping
          where mapping.role_id='role-zhudatuan-storefront-member:'||owner.organization_id) storefront_permissions,
        (select count(*)::integer from runtime.idempotency where scope=$5 and actor_id=$6 and key=$7
          and state='completed') idempotency_records
      from access.mallowner owner
      join organization.organization mall on mall.id=owner.organization_id
      join access.membership membership on membership.id=owner.membership_id
      join member.profile profile on profile.id=membership.member_id
      where owner.mall_id=$1`, [
      provisioned.plan.mall,
      provisioned.plan.pool,
      provisioned.plan.application,
      provisioned.plan.version,
      fixture.root,
      fixture.principal,
      provisioned.idempotencyKey,
    ])).rows[0];
    if (!facts) throw new Error('PROV001_DATABASE_EVIDENCE_MISSING');
    expect(facts).toEqual({
      organization_id: provisioned.plan.mall,
      scope_id: provisioned.plan.mall,
      mall_id: provisioned.plan.mall,
      parent_id: fixture.l0,
      owner_membership_id: provisioned.plan.ownerMembership,
      owner_member_id: fixture.member,
      owner_principal_id: fixture.principal,
      credentials: 1,
      organizations: 1,
      pools: 1,
      pool_bindings: 1,
      applications: 1,
      versions: 1,
      application_bindings: 1,
      memberships: 1,
      owner_records: 1,
      storefront_roles: 1,
      storefront_permissions: 14,
      idempotency_records: 1,
    });
    process.stdout.write(`PROV001_RECEIPT ${JSON.stringify({
      testBatchId,
      organizationId: facts.organization_id,
      scopeId: facts.scope_id,
      mallId: facts.mall_id,
      parentId: facts.parent_id,
      ownerMembershipId: facts.owner_membership_id,
      ownerMemberId: facts.owner_member_id,
      ownerPrincipalId: facts.owner_principal_id,
      credentials: facts.credentials,
      idempotencyRecords: facts.idempotency_records,
    })}\n`);

    const standaloneCore = (await admin.query(`select application.scope_id,pool.scope_id pool_scope,binding.mall_id
      from experience.application application
      join experience.binding binding on binding.application_id=application.id
      join catalog.pool pool on pool.id=binding.pool_id
      where application.id=$1 and application.scope_id=$2 and binding.mall_id=$2 and pool.scope_id=$2`,
    [provisioned.plan.application, provisioned.plan.mall])).rows[0];
    expect(standaloneCore).toEqual({
      scope_id: provisioned.plan.mall,
      pool_scope: provisioned.plan.mall,
      mall_id: provisioned.plan.mall,
    });

    const rollbackPlan = new CreateMall().plan({
      scope: fixture.root,
      parent: fixture.l0,
      code: fixture.rollbackCode,
      publicSlug: fixture.rollbackSlug,
      name: '回滚商城',
      actor: fixture.principal,
      actorMembership: `membership:missing:${testBatchId}`,
    });
    plans.push(rollbackPlan);
    const transaction: TransactionContext = {
      tenant: fixture.root,
      membership: fixture.l0Membership,
      scope: fixture.root,
      actor: fixture.principal,
      trace: `trace:${testBatchId}:rollback`,
      workload: 'command',
    };
    await expect(new PgUnitOfWork(pool.workload('command')).execute(transaction,
      (database) => new CreateMall().execute(database, rollbackPlan))).rejects.toThrow('MALL_OWNER_SOURCE_INVALID');
    const rollbackFacts = (await admin.query<{ organizations: number; pools: number; applications: number; memberships: number }>(`select
      (select count(*)::integer from organization.organization where id=$1) organizations,
      (select count(*)::integer from catalog.pool where id=$2) pools,
      (select count(*)::integer from experience.application where id=$3) applications,
      (select count(*)::integer from access.membership where id=$4) memberships`,
    [rollbackPlan.mall, rollbackPlan.pool, rollbackPlan.application, rollbackPlan.ownerMembership])).rows[0];
    expect(rollbackFacts).toEqual({ organizations: 0, pools: 0, applications: 0, memberships: 0 });

    await cleanupTestBatch(admin, fixture, plans);
    const cleaned = (await admin.query<{ remaining: number }>(`select (
        (select count(*) from organization.organization where id=any($1::text[]))+
        (select count(*) from access.membership where id=any($2::text[]))+
        (select count(*) from identity.principal where id=$3)+
        (select count(*) from identity.credential where principal_id=$3)+
        (select count(*) from runtime.idempotency where scope=$4 and actor_id=$3)
      )::integer remaining`, [
      [fixture.root, fixture.tenant, fixture.enterprise, fixture.l0, ...plans.map(({ mall }) => mall)],
      [fixture.l0Membership, ...plans.map(({ ownerMembership }) => ownerMembership)],
      fixture.principal,
      fixture.root,
    ])).rows[0];
    expect(cleaned).toEqual({ remaining: 0 });
    expect((await admin.query('select 1 from organization.organization where id=$1', [fixture.baseline])).rowCount).toBe(1);
    process.stdout.write(`PROV001_CLEANUP ${JSON.stringify({ testBatchId, remaining: cleaned?.remaining, baselinePreserved: true })}\n`);
  });
});

interface FixtureIdentity {
  readonly testBatchId: string;
  readonly baseline: string;
  readonly root: string;
  readonly tenant: string;
  readonly enterprise: string;
  readonly l0: string;
  readonly principal: string;
  readonly credential: string;
  readonly member: string;
  readonly l0Membership: string;
  readonly code: string;
  readonly slug: string;
  readonly rollbackCode: string;
  readonly rollbackSlug: string;
}

function fixtureIdentity(testBatchId: string): FixtureIdentity {
  const tag = createHash('sha256').update(testBatchId).digest('hex').slice(0, 12);
  return Object.freeze({
    testBatchId,
    baseline: `organization:prov001:baseline:${tag}`,
    root: `organization:prov001:platform:${tag}`,
    tenant: `organization:prov001:tenant:${tag}`,
    enterprise: `organization:prov001:enterprise:${tag}`,
    l0: `mall:prov001:l0:${tag}`,
    principal: `principal:prov001:${tag}`,
    credential: `credential:prov001:${tag}`,
    member: `member:prov001:${tag}`,
    l0Membership: `membership:prov001:l0-owner:${tag}`,
    code: `HONGTAI_${tag.toUpperCase()}`,
    slug: `hongtai-${tag}`,
    rollbackCode: `ROLLBACK_${tag.toUpperCase()}`,
    rollbackSlug: `rollback-${tag}`,
  });
}

async function seedTestL0Owner(admin: Client, fixture: FixtureIdentity): Promise<void> {
  await admin.query(`insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
    values($1,'platform',null,'PROV-001 Baseline','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp()),
      ($2,'platform',null,'PROV-001 Platform','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp()),
      ($3,'tenant',$2,'PROV-001 Tenant','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp()),
      ($4,'enterprise',$3,'PROV-001 Enterprise','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp()),
      ($5,'mall',$4,'PROV-001 L0','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp())`,
  [fixture.baseline, fixture.root, fixture.tenant, fixture.enterprise, fixture.l0]);
  await admin.query(`insert into organization.unitclosure(ancestor_id,descendant_id,depth) values
    ($1,$1,0),($1,$2,1),($1,$3,2),($1,$4,3),
    ($2,$2,0),($2,$3,1),($2,$4,2),($3,$3,0),($3,$4,1),($4,$4,0)`,
  [fixture.root, fixture.tenant, fixture.enterprise, fixture.l0]);
  await admin.query(`insert into organization.sourcebinding(source_type,source_id,organization_id,source_code)
    values('mall',$1,$1,'PROV001_L0')`, [fixture.l0]);
  await admin.query(`insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values($1,'active',1,clock_timestamp(),clock_timestamp(),0)`, [fixture.principal]);
  await admin.query(`insert into identity.credential(id,principal_id,provider,subject_hash,status,created_at)
    values($1,$2,'password',$3,'active',clock_timestamp())`,
  [fixture.credential, fixture.principal, createHash('sha256').update(fixture.testBatchId).digest('hex')]);
  await admin.query(`insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values($1,$2,'PROV-001 L0 Owner','active',clock_timestamp(),clock_timestamp(),0)`,
  [fixture.member, fixture.principal]);
  await admin.query(`insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values($1,$2,$3,'operator','active',1,clock_timestamp())`,
  [fixture.l0Membership, fixture.member, fixture.l0]);
  await admin.query(`insert into access.membershiprole(membership_id,role_id,effective_at)
    values($1,'role:self',clock_timestamp())`, [fixture.l0Membership]);
  await admin.query(`insert into access.scopegrant(
      id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version
    ) values
      ($1,$4,'mall',$5,$5,'allow',clock_timestamp(),1),
      ($2,$4,'owner',$6,$6,'allow',clock_timestamp(),1),
      ($3,$4,'self',$7,$7,'allow',clock_timestamp(),1)`, [
    `scope:${fixture.l0Membership}:mall`,
    `scope:${fixture.l0Membership}:owner`,
    `scope:${fixture.l0Membership}:self`,
    fixture.l0Membership,
    fixture.l0,
    fixture.member,
    `self:${fixture.principal}`,
  ]);
  await admin.query(`insert into access.mallowner(
      mall_id,organization_id,scope_id,membership_id,source_membership_id,created_at
    ) values($1,$1,$1,$2,$2,clock_timestamp())`, [fixture.l0, fixture.l0Membership]);
}

async function createL1MallFixture(app: Awaited<ReturnType<typeof bootstrapApi>>['app'], fixture: FixtureIdentity): Promise<{
  readonly created: CreatedMall;
  readonly plan: MallProvisioningPlan;
  readonly idempotencyKey: string;
}> {
  const idempotencyKey = `prov001:${fixture.testBatchId}:create-l1`;
  const body = { parentId: fixture.l0, code: fixture.code, publicSlug: fixture.slug, name: '宏泰甄选' };
  const first = await createMallRequest(app, body, idempotencyKey);
  const serialReplay = await createMallRequest(app, body, idempotencyKey);
  const concurrentReplays = await Promise.all([
    createMallRequest(app, body, idempotencyKey),
    createMallRequest(app, body, idempotencyKey),
  ]);
  for (const response of [first, serialReplay, ...concurrentReplays]) {
    expect(response.status).toBe(201);
    expect(response.body).toEqual(first.body);
  }
  const created = first.body as CreatedMall;
  const ready = await app.handle(new Request(`https://local.test/api/v1/provisioning/malls/${encodeURIComponent(created.mallId)}`, {
    headers: { authorization: 'Bearer test', 'x-contract-version': '1.0.0' },
  }));
  expect(ready.status).toBe(200);
  expect(created).toMatchObject(await ready.json() as object);
  const plan = new CreateMall().plan({
    scope: fixture.root,
    parent: fixture.l0,
    code: fixture.code,
    publicSlug: fixture.slug,
    name: '宏泰甄选',
    actor: fixture.principal,
    actorMembership: fixture.l0Membership,
  });
  return { created, plan, idempotencyKey };
}

function taskReceipt(mallId: string) {
  return {
    schema_version: 'sfl.autonode-control-task-receipt.v1' as const,
    task_id: `task:${mallId}`,
    action: 'ACTIVATE' as const,
    node_id: `node:${mallId}:l1`,
    status: 'QUEUED' as const,
    phase: 'QUEUED',
    progress: 0,
    plan_digest: null,
    activation_status: null,
    waiting_external: [],
    last_error: null,
    platform: { mall_id: mallId, application_id: null, name: null, public_slug: null },
    result: null,
    events: [{ phase: 'QUEUED', message: '平台创建任务已进入执行队列', occurred_at: '2026-09-14T03:00:00.000Z' }],
    created_at: '2026-09-14T03:00:00.000Z',
    updated_at: '2026-09-14T03:00:00.000Z',
    started_at: null,
    finished_at: null,
  };
}

async function createMallRequest(app: Awaited<ReturnType<typeof bootstrapApi>>['app'], body: Readonly<Record<string, unknown>>,
  idempotencyKey: string): Promise<{ readonly status: number; readonly body: unknown }> {
  const response = await app.handle(new Request('https://local.test/api/v1/provisioning/malls', {
    method: 'POST',
    headers: {
      authorization: 'Bearer test',
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
      'x-contract-version': '1.0.0',
    },
    body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}

function ownerAccess(fixture: FixtureIdentity): AccessContext {
  return {
    actor: {
      id: fixture.principal,
      session: `session:${fixture.testBatchId}`,
      membership: fixture.l0Membership,
      credentialVersion: 1,
      accessVersion: 1,
      target: 'console',
      assurance: { level: 2 },
    },
    membership: { id: fixture.l0Membership, active: true, accessVersion: 1, denies: [], grants: [] },
    scope: { id: fixture.root, kind: 'platform', tenant: fixture.root, path: [] },
    governance: {
      governanceLevel: 'owner',
      isExactOwner: true,
      actorMembershipId: fixture.l0Membership,
      actorPrincipalId: fixture.principal,
      organizationId: fixture.l0,
      ownerMembershipId: fixture.l0Membership,
      scope: { kind: 'mall', semanticId: fixture.l0, storageId: fixture.l0, organizationId: fixture.l0 },
      resolvedAt: new Date(),
    },
    accessVersion: 1,
    capabilities: [...MALL_PROVISIONING_OPERATION_IDS],
    assurance: { level: 2 },
    trace: `trace:${fixture.testBatchId}`,
  };
}

async function cleanupTestBatch(admin: Client, fixture: FixtureIdentity, plans: readonly MallProvisioningPlan[]): Promise<void> {
  const malls = plans.map(({ mall }) => mall);
  const applications = plans.map(({ application }) => application);
  const pools = plans.map(({ pool }) => pool);
  const memberships = [fixture.l0Membership, ...plans.map(({ ownerMembership }) => ownerMembership)];
  await admin.query('delete from runtime.idempotency where scope=$1 and actor_id=$2', [fixture.root, fixture.principal]);
  await admin.query('delete from access.mallowner where mall_id=$1 or mall_id=any($2::text[])', [fixture.l0, malls]);
  await admin.query('delete from access.scopegrant where membership_id=any($1::text[])', [memberships]);
  await admin.query('delete from access.membershiprole where membership_id=any($1::text[])', [memberships]);
  await admin.query('delete from access.membership where id=any($1::text[])', [memberships]);
  if (applications.length > 0) {
    await admin.query('delete from experience.binding where application_id=any($1::text[])', [applications]);
    await admin.query('update experience.application set head_version_id=null where id=any($1::text[])', [applications]);
    await admin.query('delete from experience.version where application_id=any($1::text[])', [applications]);
    await admin.query('delete from experience.application where id=any($1::text[])', [applications]);
  }
  if (malls.length > 0) await admin.query('delete from catalog.poolbinding where mall_id=any($1::text[])', [malls]);
  if (pools.length > 0) await admin.query('delete from catalog.pool where id=any($1::text[])', [pools]);
  if (malls.length > 0) {
    await admin.query('delete from organization.sourcebinding where organization_id=any($1::text[])', [malls]);
    await admin.query('delete from organization.organization where id=any($1::text[])', [malls]);
  }
  await admin.query('delete from organization.sourcebinding where organization_id=$1', [fixture.l0]);
  await admin.query('delete from organization.organization where id=$1', [fixture.l0]);
  await admin.query('delete from organization.organization where id=$1', [fixture.enterprise]);
  await admin.query('delete from organization.organization where id=$1', [fixture.tenant]);
  await admin.query('delete from organization.organization where id=$1', [fixture.root]);
  await admin.query('delete from identity.credential where id=$1', [fixture.credential]);
  await admin.query('delete from member.profile where id=$1', [fixture.member]);
  await admin.query('delete from identity.principal where id=$1', [fixture.principal]);
}
