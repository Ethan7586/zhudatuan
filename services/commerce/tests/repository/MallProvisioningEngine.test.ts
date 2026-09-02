import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Container } from '../../src/bootstrap/Container';
import { assertMallProvisioningRuntimeCompatibility } from '../../src/bootstrap/MallProvisioningApiRuntime';
import type { ModuleContext } from '../../src/bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../src/foundation/application/AuditSink';
import type { OperationRequest, OperationResult } from '../../src/foundation/application/OperationHandler';
import type { TransactionContext } from '../../src/foundation/application/UnitOfWork';
import { PgUnitOfWork } from '../../src/foundation/infrastructure/PgUnitOfWork';
import { DATABASE_POOL, createPool, type DatabasePool } from '../../src/foundation/persistence/Pool';
import { RecordAudit } from '../../src/modules/audit/application/command/RecordAudit';
import { PgAuditRepository } from '../../src/modules/audit/infrastructure/persistence/PgAuditRepository';
import { provisioningOperations } from '../../src/modules/provisioning/ProvisioningOperations';
import { CreateMall, type CreatedMall } from '../../src/modules/provisioning/application/CreateMall';

const runtimeConnection = process.env.SHOP_TEST_DATABASE_URL;
const adminConnection = process.env.SHOP_TEST_ADMIN_DATABASE_URL;
const endpointAvailable = runtimeConnection !== undefined && adminConnection !== undefined;

describe.runIf(endpointAvailable)('Mall provisioning engine on PostgreSQL', () => {
  const suffix = randomUUID();
  const root = `platform:provisioning:${suffix}`;
  const enterprise = `enterprise:provisioning:${suffix}`;
  const actor = `principal:provisioning:${suffix}`;
  const membership = `membership:provisioning:${suffix}`;
  const trace = `trace:provisioning:${suffix}`;
  const created: CreatedMall[] = [];
  let admin: Client;
  let pool: DatabasePool;
  let operations: ReturnType<typeof provisioningOperations>;

  beforeAll(async () => {
    admin = new Client({ connectionString: adminConnection, connectionTimeoutMillis: 5_000, statement_timeout: 20_000 });
    await admin.connect();
    await admin.query(`insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
      values($1,'platform',null,'Provisioning Test Platform','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp()),
        ($2,'enterprise',$1,'Provisioning Test Enterprise','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp())`,
    [root, enterprise]);
    await admin.query(`insert into organization.unitclosure(ancestor_id,descendant_id,depth)
      values($1,$1,0),($1,$2,1),($2,$2,0)`, [root, enterprise]);
    pool = createPool(runtimeConnection!, 'api');
    await assertMallProvisioningRuntimeCompatibility(pool);
    operations = provisioningOperations(context(pool));
  });

  afterAll(async () => {
    await pool?.end();
    if (!admin) return;
    const malls = created.map(({ mallId }) => mallId);
    const applications = created.map(({ applicationId }) => applicationId);
    const pools = created.map(({ poolId }) => poolId);
    await admin.query('delete from runtime.idempotency where scope=$1 and actor_id=$2', [root, actor]);
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
    await admin.query('delete from organization.organization where id=$1', [enterprise]);
    await admin.query('delete from organization.organization where id=$1', [root]);
    await admin.end();
  });

  it('creates one mall exactly once when the same command arrives concurrently', async () => {
    const request = createRequest('IDEMPOTENT', `idem-${suffix}`, '幂等商城', `idempotent:${suffix}`);
    const [first, second] = await Promise.all([operations.invoke(request), operations.invoke(request)]);
    expect(first).toEqual(second);
    expect(first.status).toBe(201);
    const mall = createdMall(first);
    created.push(mall);

    const evidence = (await admin.query<{ organizations: number; pools: number; applications: number; idempotency: number; audits: number }>(
      `select
        (select count(*)::integer from organization.organization where id=$1) organizations,
        (select count(*)::integer from catalog.pool where id=$2 and scope_id=$1) pools,
        (select count(*)::integer from experience.application where id=$3 and scope_id=$1) applications,
        (select count(*)::integer from runtime.idempotency where scope=$4 and actor_id=$5 and key=$6 and state='completed') idempotency,
        (select count(*)::integer from audit.record where scope_id=$4 and actor_id=$5 and action='provisioning.malls.create') audits`,
      [mall.mallId, mall.poolId, mall.applicationId, root, actor, request.input.idempotency],
    )).rows[0];
    expect(evidence).toEqual({ organizations: 1, pools: 1, applications: 1, idempotency: 1, audits: 1 });
  });

  it('serializes different commands competing for the same mall identity', async () => {
    const first = createRequest('CONCURRENT', `concurrent-${suffix}`, '并发商城', `concurrent:a:${suffix}`);
    const second = createRequest('CONCURRENT', `concurrent-${suffix}`, '并发商城', `concurrent:b:${suffix}`);
    const results = await Promise.all([operations.invoke(first), operations.invoke(second)]);
    expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
    const success = results.find(({ status }) => status === 201);
    expect(success).toBeDefined();
    created.push(createdMall(success!));
    expect(results.find(({ status }) => status === 409)?.body).toEqual({ code: 'MALL_CODE_CONFLICT' });
  });

  it('keeps generated malls empty, mutually isolated, and fully bound to their own storefront draft', async () => {
    expect(created).toHaveLength(2);
    for (const mall of created) {
      const evidence = (await admin.query<{
        parent_id: string; application_scope: string; application_state: string; validation_state: string;
        binding_mall: string; binding_pool: string; display_name: string; pool_items: number; listings: number;
        stock: number; orders: number; payments: number;
      }>(`select mall.parent_id,
          application.scope_id application_scope,application.status application_state,version.validation_state,
          binding.mall_id binding_mall,binding.pool_id binding_pool,
          version.configuration #>> '{pages,0,blocks,0,content,mallDisplayName}' display_name,
          (select count(*)::integer from catalog.poolitem where pool_id=$2) pool_items,
          (select count(*)::integer from catalog.listing where scope_id=$1) listings,
          (select count(*)::integer from inventory.stockitem where scope_id=$1) stock,
          (select count(*)::integer from ordering.orderrecord where mall_id=$1) orders,
          (select count(*)::integer from payment.intent where mall_id=$1) payments
        from organization.organization mall
        join experience.application application on application.id=$3
        join experience.version version on version.id=application.head_version_id
        join experience.binding binding on binding.application_id=application.id and binding.domain=application.public_slug
        where mall.id=$1`, [mall.mallId, mall.poolId, mall.applicationId])).rows[0];
      expect(evidence).toMatchObject({
        parent_id: enterprise,
        application_scope: mall.mallId,
        application_state: 'draft',
        validation_state: 'valid',
        binding_mall: mall.mallId,
        binding_pool: mall.poolId,
        display_name: mall.name,
        pool_items: 0,
        listings: 0,
        stock: 0,
        orders: 0,
        payments: 0,
      });
    }
    const [mallA, mallB] = created;
    const crossLinks = await admin.query(`select 1 from organization.unitclosure
      where (ancestor_id=$1 and descendant_id=$2) or (ancestor_id=$2 and descendant_id=$1)`, [mallA!.mallId, mallB!.mallId]);
    expect(crossLinks.rowCount).toBe(0);
    const contract = (await admin.query('select owner,method,path from runtime.operation where id=$1', ['provisioning.malls.create'])).rows[0];
    expect(contract).toEqual({ owner: 'provisioning', method: 'POST', path: '/api/v1/provisioning/malls' });
  });

  it('rolls back organization and catalog writes when the final storefront write fails', async () => {
    const existing = created[0]!;
    const engine = new CreateMall();
    const plan = engine.plan({
      scope: root,
      enterprise,
      code: 'ROLLBACK',
      publicSlug: existing.publicSlug,
      name: '回滚商城',
      actor,
    });
    const transaction: TransactionContext = { tenant: root, membership, scope: root, actor, trace, workload: 'command' };
    await expect(new PgUnitOfWork(pool.workload('command')).execute(transaction,
      (database) => engine.execute(database, plan))).rejects.toMatchObject({ code: '23505' });

    const halfFacts = (await admin.query<{ organizations: number; bindings: number; pools: number }>(`select
      (select count(*)::integer from organization.organization where id=$1) organizations,
      (select count(*)::integer from organization.sourcebinding where organization_id=$1) bindings,
      (select count(*)::integer from catalog.pool where id=$2) pools`, [plan.mall, plan.pool])).rows[0];
    expect(halfFacts).toEqual({ organizations: 0, bindings: 0, pools: 0 });
  });

  function createRequest(code: string, publicSlug: string, name: string, idempotency: string): OperationRequest {
    return {
      type: 'provisioning.malls.create',
      access: {
        actor: { id: actor, session: `session:${suffix}`, membership, credentialVersion: 1, accessVersion: 1,
          target: 'console', assurance: { level: 2 } },
        membership: { id: membership, active: true, accessVersion: 1, denies: [], grants: [] },
        scope: { id: root, kind: 'platform', tenant: root, path: [] },
        accessVersion: 1,
        capabilities: ['provisioning.malls.create'],
        assurance: { level: 2 },
        trace,
      },
      input: {
        path: {},
        query: {},
        headers: {},
        body: { enterpriseId: enterprise, code, publicSlug, name },
        rawBody: JSON.stringify({ enterpriseId: enterprise, code, publicSlug, name }),
        deadline: Date.now() + 20_000,
        signal: new AbortController().signal,
        idempotency,
      },
    };
  }
});

function context(pool: DatabasePool): ModuleContext {
  const container = new Container();
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, new RecordAudit(new PgAuditRepository()));
  return { container } as unknown as ModuleContext;
}

function createdMall(result: OperationResult): CreatedMall {
  expect(result.status).toBe(201);
  return result.body as CreatedMall;
}
