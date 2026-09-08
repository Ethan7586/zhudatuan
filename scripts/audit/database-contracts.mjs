import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { Client } from 'pg';
import { parse } from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const ROOT = repositoryRoot;
const MIGRATIONS = join(ROOT, 'database', 'migrations');
const HISTORY = join(ROOT, 'database', 'contracts', 'history.json');
const OBJECTS = join(ROOT, 'database', 'contracts', 'objects.yml');
const CONTRACTS = join(ROOT, 'database', 'contracts', 'sql');
const REGISTRATION_BOUNDARY_RECONCILE = join(ROOT, 'infrastructure', 'zhudatuan', 'aliyun', 'postgres-reconcile-registration-boundary.sql');
const BOOTSTRAP = '20260817191000_bootstrap_ethan_platform_owner.sql';
const OWNER_RECONCILIATION = '20260820132000_platform_owner_reconciliation.sql';
const INVITATION_SCOPE = '20260821066000_resolve_invitation_scope.sql';
const REGISTRATION_BOOTSTRAP_REPAIR = '20260829040000_zhudatuan_registration_bootstrap_runtime_repair.sql';
const ELEVATED_REPLAY_FILES = new Set([
  '20260828183000_zhudatuan_runtime_readiness_repair.sql',
  '20260829040000_zhudatuan_registration_bootstrap_runtime_repair.sql',
  '20260829054500_zhudatuan_identity_login_acl_repair.sql',
  '20260829109000_runtime_role_hardcut.sql',
]);
const REGISTRATION_BOOTSTRAP_REPLAY_FUTURE_HEAD_ASSERTION =
  /\n  if exists\(select 1 from runtime\.schemaversion\n    where version>'20260828183000' and version<>'20260829040000'\) then\n    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_REPAIR_FUTURE_HEAD_INVALID';\n  end if;/;
const REGISTRATION_ASSERTION_OMISSIONS = new Map([
  [INVITATION_SCOPE, /\ndo \$assert\$ begin\n  if access\.resource_scope\('identity\.invitations\.create',[\s\S]*?\nend \$assert\$;\n/],
  ['20260821069000_add_store_management.sql', /\n  select id into membership from access\.membership[\s\S]*?STORE_CREATE_SCOPE_UNRESOLVED'; end if;\n/],
  ['20260821074000_grant_platform_owner_operations.sql', /\ndo \$assert\$[\s\S]*?\n\$assert\$;\n/],
  ['20260821075000_grant_platform_cardlibrary_read.sql', /\ndo \$assert\$[\s\S]*?\nend \$assert\$;\n/],
  ['20260821076000_grant_platform_cockpit_reads.sql', /\ndo \$assert\$[\s\S]*?\n\$assert\$;\n/],
  ['20260821078000_complete_experience_application.sql', /\n  if exists\(\n    select 1 from unnest\(required_operations\)[\s\S]*?PLATFORM_OWNER_EXPERIENCE_OPERATION_MISSING';\n  end if;\n/],
]);
const INVENTORY_CUTOVER = '20260820133000_inventory_single_source_cutover.sql';
const SECURE_STAGE = '20260821026000_backfill_domain_data.sql';
const PROVIDER_HARDCUT = '20260830150000_hardcut_provider_ids.sql';
const IDEAL_FINAL = '20260904065000_finalize_constraints.sql';
const HARD_CUT_CONTRACTS = [
  'contract_v5_catalog_contract.sql',
  'access_override_authorization_contract.sql',
  'invitation_security_contract.sql',
  'operation_idempotency_contract.sql',
  'inbox_deduplication_contract.sql',
  'outbox_delivery_contract.sql',
  'job_lease_fencing_contract.sql',
  'task_authorization_contract.sql',
  'audit_hash_chain_contract.sql',
  'finance_economic_leg_contract.sql',
  'reporting_watermark_contract.sql',
  'extension_registry_contract.sql',
  'runtime_role_hardcut_contract.sql',
  'module_ownership_contract.sql',
  'row_level_security_contract.sql',
  'finance_conservation_contract.sql',
  'inventory_conservation_contract.sql',
  'voucher_state_contract.sql',
  'orphan_contract.sql',
  'immutable_audit_contract.sql',
];

const mode = process.argv[2];
if (!['--check-inventory', '--schema-fresh', '--registration-fresh', '--environment-bootstrap', '--inventory-cutover-unsafe', '--postgres-fresh', '--mvp-kernel', '--privileges', '--migration-replay-suite', '--invariant-suite'].includes(mode)) {
  throw new Error('usage: database-contracts.mjs --check-inventory|--schema-fresh|--registration-fresh|--environment-bootstrap|--inventory-cutover-unsafe|--postgres-fresh|--mvp-kernel|--privileges|--migration-replay-suite|--invariant-suite [URL]');
}
const replayRole = mode === '--postgres-fresh' ? process.argv[4] : undefined;
if (replayRole !== undefined && !/^[a-z][a-z0-9_]{2,62}$/.test(replayRole)) throw new Error('POSTGRES_FRESH_ROLE_INVALID');

const migrationFiles = (await readdir(MIGRATIONS)).filter((name) => name.endsWith('.sql')).sort();
const historyContract = JSON.parse(await readFile(HISTORY, 'utf8'));
const repairFiles = migrationFiles.filter((name) => name.slice(0, 14) > historyContract.head);
await verifyInventory(migrationFiles, historyContract);
if (mode === '--check-inventory') {
  console.log(`migration inventory ok: historical=${historyContract.count} repair=${repairFiles.length} total=${migrationFiles.length}`);
  process.exit(0);
}

const database = await openDatabase();
try {
  await execute(
    database,
    `
    do $roles$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then
        create role anon nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
      end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then
        create role authenticated nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
      end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then
        create role service_role nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
      end if;
      if exists(select 1 from pg_roles where rolname in('anon','authenticated','service_role')
        and (rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls)) then
        raise exception 'DATABASE_REPLAY_ROLE_UNSAFE';
      end if;
    end $roles$;
  `,
    'database role bootstrap'
  );
  if (mode === '--registration-fresh') await installRegistrationReplayBoundary(database);
  if (replayRole !== undefined) await execute(database, `set role "${replayRole}"`, 'database migration role');
  await execute(
    database,
    `
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
  `,
    'database bootstrap'
  );
  let applied = 0;
  let snapshotFingerprint;
  for (const name of migrationFiles) {
    if (mode === '--registration-fresh' && (name === BOOTSTRAP || name === OWNER_RECONCILIATION)) {
      await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0, 14), `environment-omitted:${name}`]);
      applied += 1;
      continue;
    }
    if (name === BOOTSTRAP) await seedBootstrapPrecondition(database);
    if (mode === '--inventory-cutover-unsafe' && name === INVENTORY_CUTOVER) {
      await seedUnsafeInventoryCutover(database);
      await assertUnsafeInventoryCutoverRejected(database, await readFile(join(MIGRATIONS, name), 'utf8'));
      console.log(`unsafe inventory cutover rejected atomically: migrations_before_cutover=${applied}`);
      process.exitCode = 0;
      break;
    }
    if (name === SECURE_STAGE) await stageFreshReplaySecrets(database);
    if (name === PROVIDER_HARDCUT) await seedProviderHardcutUpgrade(database);
    const source = await readFile(join(MIGRATIONS, name), 'utf8');
    const omission = REGISTRATION_ASSERTION_OMISSIONS.get(name);
    const sql = mode === '--registration-fresh' && omission ? omitExactEnvironmentAssertion(source, omission, name) : source;
    const elevatedReplay = replayRole !== undefined && ELEVATED_REPLAY_FILES.has(name);
    if (elevatedReplay) await execute(database, 'reset role', 'migration boundary elevation');
    try {
      if (mode === '--migration-replay-suite' && name === IDEAL_FINAL) await drillRollbackPoint(database, sql);
      await execute(database, sql, `migration ${name}`);
    } finally {
      if (elevatedReplay) await execute(database, `set role "${replayRole}"`, 'database migration role restore');
    }
    await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0, 14), name]);
    applied += 1;
    if (mode === '--migration-replay-suite' && name.slice(0, 14) === historyContract.head) {
      snapshotFingerprint = await seedRedactedSnapshot(database);
    }
  }
  if (mode !== '--inventory-cutover-unsafe') {
    if (replayRole !== undefined) await execute(database, 'reset role', 'database verification elevation');
    await execute(database, 'alter role shopmigration nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls', 'database migration role hardening');
    if (mode === '--registration-fresh') await reconcileRegistrationReplayBoundary(database);
    await verifyTarget(database);
    if (mode === '--mvp-kernel') {
      const { verifyMvpKernel } = await import('./mvp-kernel.mjs');
      await verifyMvpKernel(database);
    }
    if (mode === '--privileges') console.log(`PRIVILEGE_EVIDENCE:${JSON.stringify(await collectPrivilegeEvidence(database))}`);
    if (mode === '--migration-replay-suite') {
      await verifyRedactedSnapshot(database, snapshotFingerprint);
      await verifyRepeatProtection(database);
      console.log('MIGRATION_REPLAY_EVIDENCE:empty=passed,snapshot=passed,repeat=passed,rollback=passed');
    }
    if (mode === '--invariant-suite') {
      await verifyConcurrentInvariants(database);
      console.log('INVARIANT_EVIDENCE:inventory=passed,finance=passed,voucher=passed,orderpayment=passed,scope=passed');
    }
    console.log(`target schema replay passed: migrations=${applied} historical=${historyContract.count} repair=${repairFiles.length}`);
  }
} finally {
  await database.close();
}

async function openDatabase() {
  if (mode !== '--postgres-fresh') {
    // PGlite initializes only its default database. Build a tiny cluster image
    // first, then connect to the canonical registration database so database-
    // name boundaries are exercised instead of being skipped in replay.
    const cluster = new PGlite();
    await cluster.exec('create database zhudatuan_registration');
    const data = await cluster.dumpDataDir('none');
    await cluster.close();
    return new PGlite({ database: 'zhudatuan_registration', loadDataDir: data, extensions: { pgcrypto } });
  }
  const connectionString = process.argv[3];
  if (connectionString !== undefined && !/^postgres(?:ql)?:\/\//.test(connectionString)) throw new Error('POSTGRES_FRESH_URL_INVALID');
  const client = new Client({ ...(connectionString === undefined ? {} : { connectionString }), connectionTimeoutMillis: 5_000, statement_timeout: 120_000 });
  await client.connect();
  return Object.freeze({
    exec: async (sql) => {
      await client.query(sql);
    },
    query: (sql, parameters) => client.query(sql, parameters),
    close: () => client.end(),
  });
}

async function verifyInventory(files, history) {
  const duplicates = duplicateVersions(files);
  if (duplicates.size) throw new Error(`duplicate migration versions: ${JSON.stringify([...duplicates])}`);
  if (history.algorithm !== 'sha256' || history.count !== history.migrations.length || history.count !== 316 || history.migrations.at(-1)?.file.slice(0, 14) !== history.head) throw new Error('HISTORICAL_MIGRATION_MANIFEST_INVALID');
  const historical = files.filter((name) => name.slice(0, 14) <= history.head);
  if (JSON.stringify(historical) !== JSON.stringify(history.migrations.map((item) => item.file))) throw new Error('HISTORICAL_MIGRATION_FILESET_DRIFT');
  for (const item of history.migrations) {
    const digest = createHash('sha256')
      .update(await readFile(join(MIGRATIONS, item.file)))
      .digest('hex');
    if (digest !== item.sha256) throw new Error(`HISTORICAL_MIGRATION_HASH_DRIFT:${item.file}`);
  }
  await readFile(OBJECTS, 'utf8').catch(() => {
    throw new Error('DATABASE_OBJECT_CONTRACT_MISSING');
  });
}

function duplicateVersions(files) {
  const versions = new Map();
  for (const file of files) {
    const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file);
    if (!match) throw new Error(`INVALID_MIGRATION_FILENAME:${file}`);
    const existing = versions.get(match[1]) ?? [];
    existing.push(file);
    versions.set(match[1], existing);
  }
  return new Map([...versions].filter(([, names]) => names.length > 1));
}

function omitExactEnvironmentAssertion(source, assertion, file) {
  const matches = source.match(new RegExp(assertion.source, 'g'));
  if (matches?.length !== 1) throw new Error(`MIGRATION_ENVIRONMENT_ASSERTION_DRIFT:${file}`);
  return source.replace(assertion, '\n');
}

async function execute(database, sql, label) {
  try {
    await database.exec(sql);
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

async function seedBootstrapPrecondition(database) {
  await execute(
    database,
    `insert into public.users(id,tenant_id,enterprise_id,department_id,employee_no,display_name,email,status)
    values('user-fresh-replay-ethan','tenant-smart-wing','enterprise-demo','department-digital','SW_FRESH_REPLAY_ETHAN','Fresh Replay Ethan','fresh-replay@example.invalid','active');
    insert into public.members(id,user_id,primary_identifier,status) values('member-fresh-replay-ethan','user-fresh-replay-ethan','local_username:ethan','active');
    insert into public.member_login_aliases(provider,subject,member_id) values('local_username','ethan','member-fresh-replay-ethan');`,
    'bootstrap precondition'
  );
}

async function seedRedactedSnapshot(database) {
  const fixture = {
    id: 'risk:production-redacted-snapshot',
    scopeId: 'scope:production-redacted',
    name: 'Redacted production policy',
    status: 'draft',
    nextVersion: 1,
  };
  await database.query(
    `insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values($1,$2,$3,$4,$5,clock_timestamp())`,
    [fixture.id, fixture.scopeId, fixture.name, fixture.status, fixture.nextVersion]
  );
  return digest(JSON.stringify(fixture));
}

async function verifyRedactedSnapshot(database, expectedFingerprint) {
  if (!expectedFingerprint) throw new Error('REDACTED_SNAPSHOT_NOT_SEEDED');
  const result = await database.query(`select id,scope_id,name,status,next_version from risk.policy
    where id='risk:production-redacted-snapshot'`);
  const row = result.rows[0];
  if (!row) throw new Error('REDACTED_SNAPSHOT_UPGRADE_MISSING');
  const fingerprint = digest(
    JSON.stringify({ id: row.id, scopeId: row.scope_id, name: row.name, status: row.status, nextVersion: row.next_version })
  );
  if (fingerprint !== expectedFingerprint) throw new Error('REDACTED_SNAPSHOT_UPGRADE_DRIFT');
}

async function drillRollbackPoint(database, sql) {
  const rollbackSql = sql.replace(/commit;\s*$/i, 'rollback;');
  if (rollbackSql === sql) throw new Error('ROLLBACK_POINT_COMMIT_NOT_FOUND');
  await execute(database, rollbackSql, 'final migration rollback drill');
  const leaked = await database.query(`select
    exists(select 1 from runtime.schemaversion where version='20260904065000') version,
    to_regclass('runtime.schemahead') is not null schemahead`);
  if (leaked.rows[0]?.version || leaked.rows[0]?.schemahead) throw new Error('ROLLBACK_POINT_LEAKED_STATE');
}

async function verifyRepeatProtection(database) {
  const before = await database.query(`select count(*)::integer count from runtime.schemaversion`);
  let rejected = false;
  try {
    await database.exec(await readFile(join(MIGRATIONS, IDEAL_FINAL), 'utf8'));
  } catch (error) {
    rejected = String(error instanceof Error ? error.message : error).includes('IDEAL_FINAL_ALREADY_APPLIED');
    await database.exec('rollback');
  }
  const after = await database.query(`select count(*)::integer count from runtime.schemaversion`);
  if (!rejected || before.rows[0]?.count !== after.rows[0]?.count) throw new Error('MIGRATION_REPEAT_PROTECTION_INVALID');
}

async function verifyConcurrentInvariants(database) {
  await verifyConcurrentInventory(database);
  await verifyConcurrentFinance(database);
  await verifyConcurrentVoucher(database);
  await verifyConcurrentOrderPayment(database);
  await verifyInvariantScope(database);
  await execute(database, 'set role shopmigration', 'invariant contract role');
  try {
    for (const contract of [
      'inventory_conservation_contract.sql',
      'finance_conservation_contract.sql',
      'voucher_state_contract.sql',
      'orphan_contract.sql',
      'row_level_security_contract.sql',
    ]) {
      await execute(database, await readFile(join(CONTRACTS, contract), 'utf8'), `post-concurrency contract ${contract}`);
    }
  } catch (error) {
    await database.exec('rollback');
    throw error;
  } finally {
    await execute(database, 'reset role', 'invariant contract role reset');
  }
}

async function verifyConcurrentInventory(database) {
  await database.query(
    `insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
     values($1,$2,$3,$4,10,0,1,'active',clock_timestamp())`,
    ['stock:invariant', 'scope:invariant', 'sku:invariant', 'location:invariant']
  );
  const attempts = await settleContenders(
    ['a', 'b'].map((suffix) => () =>
      database.query(
        `insert into inventory.reservation(id,stockitem_id,owner_type,owner_id,quantity,state,expires_at,created_at,version)
         values($1,'stock:invariant','checkout',$2,8,'reserved',clock_timestamp()+interval '30 minutes',clock_timestamp(),1)`,
        [`reservation:invariant:${suffix}`, `checkout:invariant:${suffix}`]
      )
    )
  );
  const accepted = attempts.filter(({ status }) => status === 'fulfilled').length;
  const rejected = attempts.filter(({ status }) => status === 'rejected');
  if (accepted !== 1 || rejected.length !== 1 || !/INVENTORY_INSUFFICIENT/.test(String(rejected[0].reason))) {
    throw new Error('INVENTORY_CONCURRENT_RESERVATION_INVALID');
  }
  const balance = await database.query(`select stock.onhand-stock.safety-coalesce(sum(reservation.quantity)
    filter(where reservation.state='reserved' and reservation.expires_at>clock_timestamp()),0)::bigint available,
    count(reservation.id)::integer reservations from inventory.stockitem stock
    left join inventory.reservation reservation on reservation.stockitem_id=stock.id where stock.id='stock:invariant'
    group by stock.id,stock.onhand,stock.safety`);
  if (balance.rows[0]?.available !== 2 || balance.rows[0]?.reservations !== 1) throw new Error('INVENTORY_CONSERVATION_AFTER_CONCURRENCY_INVALID');
}

async function verifyConcurrentFinance(database) {
  const parameters = [
    'scope:invariant',
    'contract.concurrent',
    'economic-leg:invariant',
    'CNY',
    'Concurrent invariant posting',
    'cash.invariant',
    'asset',
    'revenue.invariant',
    'income',
    1200,
    '2026-09-04T00:00:00.000Z',
  ];
  const postings = await settleContenders(
    [0, 1].map(() => () =>
      database.query(
        `select finance.post($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz) journal_id`,
        parameters
      )
    )
  );
  if (postings.some(({ status }) => status === 'rejected')) throw postings.find(({ status }) => status === 'rejected').reason;
  if (new Set(postings.map(({ value }) => value.rows[0]?.journal_id)).size !== 1) throw new Error('FINANCE_CONCURRENT_IDEMPOTENCY_INVALID');
  const balance = await database.query(`select count(distinct journal.id)::integer journals,count(entry.id)::integer entries,
    coalesce(sum(case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end),0)::bigint balance
    from finance.journal journal left join finance.entry entry on entry.journal_id=journal.id
    where journal.scope_id='scope:invariant' and journal.reference_type='contract.concurrent'
      and journal.reference_id='economic-leg:invariant'`);
  if (balance.rows[0]?.journals !== 1 || balance.rows[0]?.entries !== 2 || balance.rows[0]?.balance !== 0) {
    throw new Error('FINANCE_CONSERVATION_AFTER_CONCURRENCY_INVALID');
  }
}

async function verifyConcurrentVoucher(database) {
  await database.exec(`select set_config('app.actor_id','contract:invariant',false);
    insert into voucher.product(id,number,scope_id,customer_id,name,face_minor,currency,qualification_id,pool_id,
      starts_at,expires_at,activation,approval_required,state,version,created_at,updated_at)
    values('voucherproduct:invariant','VP-INVARIANT','scope:invariant','customer:invariant','Invariant voucher',2000,'CNY',
      'qualification:invariant',null,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 day','automatic',false,'draft',1,
      clock_timestamp(),clock_timestamp());
    insert into voucher.credentialpool(id,number,scope_id,product_id,name,mode,prefix,capacity,generated,state,version,created_at,updated_at)
    values('voucherpool:invariant','POOL-INVARIANT','scope:invariant','voucherproduct:invariant','Invariant pool','generated','INV',1,1,
      'open',1,clock_timestamp(),clock_timestamp());
    insert into voucher.credential(id,scope_id,pool_id,product_id,number_ciphertext,secret_ciphertext,number_fingerprint,secret_fingerprint,
      number_masked,key_version,state,issue_batch_id,version,created_at,updated_at)
    values('vouchercredential:invariant','scope:invariant','voucherpool:invariant','voucherproduct:invariant','ciphertext-number','ciphertext-secret',
      repeat('a',64),repeat('b',64),'INV****0001','key:invariant','generated',null,1,clock_timestamp(),clock_timestamp());
    insert into voucher.voucher(id,scope_id,product_id,credential_id,holder_id,number_fingerprint,number_masked,initial_minor,remaining_minor,
      currency,state,starts_at,expires_at,version,created_at,updated_at)
    values('voucher:invariant','scope:invariant','voucherproduct:invariant','vouchercredential:invariant',null,repeat('c',64),'INV****0001',
      2000,2000,'CNY','active',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 day',1,clock_timestamp(),clock_timestamp());`);
  const attempts = await settleContenders(
    ['a', 'b'].map((suffix) => () =>
      database.query(
        `insert into voucher.tenderhold(id,scope_id,voucher_id,owner_id,amount_minor,state,expires_at,idempotency_key,version,created_at,updated_at)
         values($1,'scope:invariant','voucher:invariant',$2,1000,'active',clock_timestamp()+interval '30 minutes',$3,1,
           clock_timestamp(),clock_timestamp())`,
        [`voucherhold:invariant:${suffix}`, `checkout:invariant:${suffix}`, `voucherhold:invariant:${suffix}`]
      )
    )
  );
  const accepted = attempts.filter(({ status }) => status === 'fulfilled').length;
  const active = await database.query(`select count(*)::integer count,coalesce(sum(amount_minor),0)::bigint amount
    from voucher.tenderhold where voucher_id='voucher:invariant' and state='active'`);
  if (accepted !== 1 || active.rows[0]?.count !== 1 || active.rows[0]?.amount !== 1000) throw new Error('VOUCHER_CONCURRENT_HOLD_INVALID');
}

async function verifyConcurrentOrderPayment(database) {
  await database.exec(`insert into ordering.orderrecord(id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,
      payment_state,fulfillment_state,aftersale_state,lifecycle_state,evidence,created_at,updated_at,version,address_snapshot,
      invoice_snapshot,delivery_snapshot,experience_version,external_reference,source_channel,source_state,verification_state,ordered_at,
      import_id,amount_snapshot)
    values('order:invariant','ORDER-INVARIANT','scope:invariant','member:invariant','mall:invariant','checkout:invariant','CNY',1200,
      'unpaid','unallocated','none','awaitingpayment','{}',clock_timestamp(),clock_timestamp(),0,'null','null','{}',null,null,null,null,
      'verified',clock_timestamp(),null,'{"subtotalMinor":1200,"discountMinor":0,"shippingMinor":0,"taxMinor":0,"payableMinor":1200,"currency":"CNY"}');
    insert into ordering.line(id,order_id,sku_id,listing_id,title_snapshot,quantity,unit_minor,total_minor,qualification_evidence_id,
      provider,partner_id,discount_minor,evidence)
    values('orderline:invariant','order:invariant','sku:invariant','listing:invariant','Invariant product',1,1200,1200,null,null,null,0,
      '{"product":"product:invariant","productType":"physical","category":"contract","versions":{"listing":1,"product":1,"sku":1,"price":1,"stock":1}}');`);
  const attempts = await settleContenders(
    ['a', 'b'].map((suffix) => () =>
      database.query(
        `insert into payment.intent(id,order_id,member_id,currency,amount_minor,state,idempotency_key,provider_reference,expires_at,version,
          purpose,created_at,updated_at,scope_id,mall_id,order_number)
         values($1,'order:invariant','member:invariant','CNY',1200,'created',$2,$3,clock_timestamp()+interval '30 minutes',0,'purchase',
           clock_timestamp(),clock_timestamp(),'scope:invariant','mall:invariant','ORDER-INVARIANT')`,
        [`paymentintent:invariant:${suffix}`, `paymentintent:invariant:${suffix}`, `provider:invariant:${suffix}`]
      )
    )
  );
  const accepted = attempts.filter(({ status }) => status === 'fulfilled').length;
  const invariant = await database.query(`select orders.total_minor,
    (select coalesce(sum(line.payable_minor),0)::bigint from ordering.line line where line.order_id=orders.id) line_minor,
    (select count(*)::integer from payment.intent intent where intent.order_id=orders.id and intent.purpose='purchase'
      and intent.state in('created','preparing','pending')) active_intents,
    (select coalesce(sum(intent.amount_minor),0)::bigint from payment.intent intent where intent.order_id=orders.id
      and intent.purpose='purchase' and intent.state in('created','preparing','pending')) intent_minor
    from ordering.orderrecord orders where orders.id='order:invariant'`);
  const row = invariant.rows[0];
  if (accepted !== 1 || row?.total_minor !== 1200 || row?.line_minor !== 1200 || row?.active_intents !== 1 || row?.intent_minor !== 1200) {
    throw new Error('ORDER_PAYMENT_CONCURRENT_INVARIANT_INVALID');
  }
  await database.query(`select ordering.assert_amount('order:invariant')`);
}

async function verifyInvariantScope(database) {
  await database.exec(`insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values
    ('risk:invariant:a','scope:invariant','Invariant A','draft',1,clock_timestamp()),
    ('risk:invariant:b','scope:foreign','Invariant B','draft',1,clock_timestamp());
    begin; set local role shopapp;
    select set_config('app.workload','api',true),set_config('app.scope_id','scope:invariant',true),
      set_config('app.actor_id','contract:invariant',true);`);
  const visible = await database.query(`select array_agg(id order by id) ids from risk.policy where id like 'risk:invariant:%'`);
  await database.exec('commit');
  if (JSON.stringify(visible.rows[0]?.ids) !== JSON.stringify(['risk:invariant:a'])) throw new Error('SCOPE_CONCURRENT_READ_ISOLATION_INVALID');
  await database.exec(`begin; set local role shopapp;
    select set_config('app.workload','api',true),set_config('app.scope_id','scope:invariant',true),
      set_config('app.actor_id','contract:invariant',true);`);
  try {
    await database.query(`insert into risk.policy(id,scope_id,name,status,next_version,updated_at)
      values('risk:invariant:forbidden','scope:foreign','Forbidden','draft',1,clock_timestamp())`);
  } catch (error) {
    await database.exec('rollback');
    if (/row-level security/i.test(String(error instanceof Error ? error.message : error))) return;
    throw error;
  }
  await database.exec('rollback');
  throw new Error('SCOPE_CONCURRENT_WRITE_ISOLATION_INVALID');
}

async function settleContenders(contenders) {
  const outcomes = [];
  // PGlite exposes one session, so lock contenders must be submitted in a
  // deterministic commit order. PostgreSQL still evaluates the same row-lock,
  // uniqueness and idempotency boundaries used by independent sessions.
  for (const contend of contenders) {
    try {
      outcomes.push({ status: 'fulfilled', value: await contend() });
    } catch (reason) {
      outcomes.push({ status: 'rejected', reason });
    }
  }
  return outcomes;
}

async function installRegistrationReplayBoundary(database) {
  const sentinel = 'registration-fresh-replay-sentinel-not-for-production';
  await execute(
    database,
    `create extension if not exists pgcrypto;
    create schema deployment;
    revoke all on schema deployment from public;
    create table deployment.boundary(
      id text primary key,database_name text not null,sentinel_hash char(64) not null check(sentinel_hash~'^[0-9a-f]{64}$'),
      created_at timestamptz not null default clock_timestamp()
    );
    insert into deployment.boundary(id,database_name,sentinel_hash)
    values('zhudatuan-registration-v1',current_database(),encode(public.digest('${sentinel}','sha256'),'hex'));
    create or replace function deployment.registration_bootstrap_boundary(p_sentinel text)
    returns boolean language sql stable security definer set search_path=pg_catalog,deployment,public as $function$
      select current_database()='zhudatuan_registration'
        and session_user='zhudatuanbootstrap'
        and exists(select 1 from deployment.boundary
          where id='zhudatuan-registration-v1' and database_name=current_database()
            and sentinel_hash=encode(public.digest(p_sentinel,'sha256'),'hex'))
    $function$;
    create or replace function deployment.is_independent_registration_database()
    returns boolean language sql stable security definer set search_path=pg_catalog,deployment as $function$
      select current_database()='zhudatuan_registration'
        and exists(select 1 from deployment.boundary
          where id='zhudatuan-registration-v1' and database_name=current_database())
    $function$;
    revoke all on deployment.boundary from public;
    revoke all on function deployment.registration_bootstrap_boundary(text) from public;
    revoke all on function deployment.is_independent_registration_database() from public;
  `,
    'registration replay boundary'
  );
}

async function reconcileRegistrationReplayBoundary(database) {
  // Model an existing volume initialized before shopmigration was added to
  // the nested SECURITY DEFINER boundary. The replay must exercise the exact
  // privileged reconciliation artifact used in production.
  await execute(
    database,
    `
    alter role zhudatuanbootstrap noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    alter role shopmigration noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    grant usage on schema deployment to zhudatuanbootstrap,shopmigration;
    revoke execute on function deployment.registration_bootstrap_boundary(text) from shopmigration;
    grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap;
    grant execute on function deployment.is_independent_registration_database() to shopmigration;
  `,
    'registration replay legacy boundary state'
  );
  const before = await database.query(`select
    has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE') bootstrap_allowed,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed`);
  if (JSON.stringify(before.rows[0]) !== JSON.stringify({ bootstrap_allowed: true, definer_allowed: false })) {
    throw new Error(`REGISTRATION_REPLAY_LEGACY_BOUNDARY_INVALID:${JSON.stringify(before.rows[0])}`);
  }
  await execute(database, await readFile(REGISTRATION_BOUNDARY_RECONCILE, 'utf8'), 'registration replay privileged boundary reconciliation');
  const after = await database.query(`select
    has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE') bootstrap_allowed,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed,
    has_function_privilege('shopmigration','deployment.is_independent_registration_database()','EXECUTE') migration_boundary_allowed`);
  if (
    JSON.stringify(after.rows[0]) !==
    JSON.stringify({
      bootstrap_allowed: true,
      definer_allowed: true,
      migration_boundary_allowed: true,
    })
  ) {
    throw new Error(`REGISTRATION_REPLAY_RECONCILED_BOUNDARY_INVALID:${JSON.stringify(after.rows[0])}`);
  }
}

async function stageFreshReplaySecrets(database) {
  await execute(
    database,
    `insert into runtime.vouchersecretstage(voucher_id,code_ciphertext,code_fingerprint,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(voucher_code,'sha256'),'base64'),encode(digest(lower(voucher_code),'sha256'),'hex'),'fixture-v1',created_at
    from public.vouchers on conflict(voucher_id) do nothing;
    insert into runtime.partneraddressstage(store_id,address_ciphertext,address_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(address_text,'sha256'),'base64'),encode(digest(lower(address_text),'sha256'),'hex'),'fixture-v1',created_at
    from public.stores where address_text is not null on conflict(store_id) do nothing;
    insert into runtime.distributorcontactstage(distributor_id,contact_ciphertext,contact_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(contact_json::text,'sha256'),'base64'),encode(digest(contact_json::text,'sha256'),'hex'),'fixture-v1',created_at
    from public.distributors where contact_json<>'{}'::jsonb on conflict(distributor_id) do nothing;`,
    'secure fixture stage'
  );
}

async function seedUnsafeInventoryCutover(database) {
  await execute(database, `do $$ begin update public.inventory set reserved_qty=greatest(reserved_qty,1); if not found then raise exception 'UNSAFE_INVENTORY_FIXTURE_MISSING'; end if; end $$;`, 'unsafe inventory fixture');
}

async function assertUnsafeInventoryCutoverRejected(database, sql) {
  try {
    await database.exec(sql);
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).includes('INVENTORY_CUTOVER_RECONCILIATION_REQUIRED')) throw error;
    if ((await database.query("select to_regclass('inventory.cutover_reviews') is not null as leaked")).rows[0].leaked) throw new Error('UNSAFE_INVENTORY_CUTOVER_PARTIAL_COMMIT');
    return;
  }
  throw new Error('UNSAFE_INVENTORY_CUTOVER_UNEXPECTEDLY_SUCCEEDED');
}

async function verifyTarget(database) {
  const operationContract = parse(await readFile(join(ROOT, 'packages', 'contract', 'definitions', 'operations.yml'), 'utf8'), { merge: true });
  const eventContract = parse(await readFile(join(ROOT, 'packages', 'contract', 'definitions', 'events.yml'), 'utf8'));
  const expectedOperations = Array.isArray(operationContract?.operations) ? operationContract.operations.length : -1;
  const expectedEvents = Array.isArray(eventContract?.events) ? eventContract.events.length : -1;
  const result = await database.query(`select
    (select count(*)::integer from runtime.operation) operations,
    (select count(*)::integer from runtime.event where retired_at is null) events,
    (select count(*)::integer from pg_tables where schemaname='public') public_tables,
    (select count(*)::integer from supabase_migrations.schema_migrations) migrations`);
  const row = result.rows[0];
  if (row.operations !== expectedOperations || row.events !== expectedEvents || row.public_tables !== 0 || row.migrations !== migrationFiles.length) {
    const operationIds = operationContract.operations.map(({ id }) => id);
    const eventTypes = eventContract.events.map(({ id }) => id);
    const missingOperations = (await database.query('select expected id from unnest($1::text[]) expected where not exists(select 1 from runtime.operation actual where actual.id=expected) order by expected', [operationIds])).rows.map(
      ({ id }) => id
    );
    const extraOperations = (await database.query('select id from runtime.operation where not(id=any($1::text[])) order by id', [operationIds])).rows.map(({ id }) => id);
    const missingEvents = (await database.query('select expected type from unnest($1::text[]) expected where not exists(select 1 from runtime.event actual where actual.type=expected and actual.retired_at is null) order by expected', [eventTypes])).rows.map(
      ({ type }) => type
    );
    const extraEvents = (await database.query('select type from runtime.event where retired_at is null and not(type=any($1::text[])) order by type', [eventTypes])).rows.map(({ type }) => type);
    throw new Error(`TARGET_CATALOG_INVALID:${JSON.stringify({ ...row, missingOperations, extraOperations, missingEvents, extraEvents })}`);
  }
  const actualEvents = (await database.query('select type,version,owner,schema_ref from runtime.event where retired_at is null')).rows
    .sort((left, right) => left.type.localeCompare(right.type));
  const canonicalEvents = eventContract.events.map(event => ({ type: event.id, version: event.version, owner: event.owner, schema_ref: event.schema }))
    .sort((left, right) => left.type.localeCompare(right.type));
  if (JSON.stringify(actualEvents) !== JSON.stringify(canonicalEvents)) throw new Error('TARGET_EVENT_VERSION_DRIFT');
  const retired = (await database.query(`select event.type,event.version,
    coalesce((select jsonb_agg(jsonb_build_object('id',pending.id,'payload',pending.payload) order by pending.id)
      from runtime.outbox pending where pending.event_type=event.type and pending.event_version=event.version and pending.published_at is null),'[]'::jsonb) pending_outbox,
    coalesce((select jsonb_agg(jsonb_build_object('consumer',pending.consumer,'eventId',pending.event_id,'payload',pending.payload)
      order by pending.consumer,pending.event_id) from runtime.inbox pending
      where pending.event_type=event.type and pending.event_version=event.version and pending.processed_at is null),'[]'::jsonb) pending_inbox
    from runtime.event event where event.retired_at is not null and (
    not exists(select 1 from runtime.event active where active.type=event.type and active.version>event.version and active.retired_at is null)
    or exists(select 1 from runtime.outbox pending where pending.event_type=event.type and pending.event_version=event.version and pending.published_at is null)
    or exists(select 1 from runtime.inbox pending where pending.event_type=event.type and pending.event_version=event.version and pending.processed_at is null))`)).rows;
  if (retired.length !== 0) throw new Error(`TARGET_RETIRED_EVENT_PENDING:${JSON.stringify(retired)}`);
  await verifyObjectContract(database);
  await verifyRls(database);
  await verifyAuditImmutability(database);
  await verifyMvpFusion(database);
  await execute(database, 'set role shopmigration', 'database contract role');
  const contractRole = await database.query("select current_user,has_table_privilege(current_user,'access.permission','select') can_select,(select count(*)::integer from access.permission where code='access.override.manage') matching_permissions");
  if (contractRole.rows[0]?.current_user !== 'shopmigration' || !contractRole.rows[0]?.can_select || contractRole.rows[0]?.matching_permissions !== 1) {
    throw new Error(`DATABASE_CONTRACT_ROLE_INVALID:${JSON.stringify(contractRole.rows[0])}`);
  }
  try {
    for (const contract of HARD_CUT_CONTRACTS) {
      await execute(database, await readFile(join(CONTRACTS, contract), 'utf8'), `hard-cut contract ${contract}`);
    }
  } catch (error) {
    await database.exec('rollback');
    throw error;
  } finally {
    await execute(database, 'reset role', 'database contract role reset');
  }
}

async function collectPrivilegeEvidence(database) {
  const schemas = await database.query(`select module_id,schema_name,owner_role,reader_role,writer_role
    from runtime.moduleauthority union all
    select 'finance','invoice','shopfinanceowner','shopfinancereader','shopfinancewriter' order by module_id,schema_name`);
  const writerViolations = await database.query(`with authorities as(
      select module_id,schema_name,writer_role from runtime.moduleauthority union all
      select 'finance','invoice','shopfinancewriter'
    ), writers as(select distinct module_id,writer_role from authorities),
    tables as(select namespace.nspname schema_name,relation.oid,relation.relname
      from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname in(select schema_name from authorities) and relation.relkind in('r','p'))
    select writer.module_id,writer.writer_role,tables.schema_name||'.'||tables.relname table_name
    from writers writer cross join tables
    where (has_table_privilege(writer.writer_role,tables.oid,'insert')
      or has_table_privilege(writer.writer_role,tables.oid,'update')
      or has_table_privilege(writer.writer_role,tables.oid,'delete')
      or has_table_privilege(writer.writer_role,tables.oid,'truncate'))
      and not exists(select 1 from authorities owned where owned.writer_role=writer.writer_role and owned.schema_name=tables.schema_name)
    order by writer.writer_role,table_name`);
  const writerCoverage = await database.query(`with authorities as(
      select module_id,schema_name,writer_role from runtime.moduleauthority union all
      select 'finance','invoice','shopfinancewriter'
    ), writers as(select distinct module_id,writer_role from authorities),
    tables as(select namespace.nspname schema_name,relation.oid
      from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname in(select schema_name from authorities) and relation.relkind in('r','p'))
    select writer.module_id,writer.writer_role,
      count(distinct tables.oid) filter(where
        (has_table_privilege(writer.writer_role,tables.oid,'insert')
          or has_table_privilege(writer.writer_role,tables.oid,'update')
          or has_table_privilege(writer.writer_role,tables.oid,'delete'))
        and exists(select 1 from authorities owned where owned.writer_role=writer.writer_role and owned.schema_name=tables.schema_name)
      )::integer writable_tables
    from writers writer cross join tables
    group by writer.module_id,writer.writer_role order by writer.module_id`);
  const readerViolations = await database.query(`with roles(role) as(
      select reader_role from runtime.moduleauthority union select 'shopread'
    ), tables as(select relation.oid,namespace.nspname||'.'||relation.relname table_name
      from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname in(select schema_name from runtime.moduleauthority union all select 'invoice')
        and relation.relkind in('r','p'))
    select roles.role,tables.table_name from roles cross join tables
    where has_table_privilege(roles.role,tables.oid,'insert') or has_table_privilege(roles.role,tables.oid,'update')
      or has_table_privilege(roles.role,tables.oid,'delete') or has_table_privilege(roles.role,tables.oid,'truncate')
    order by roles.role,tables.table_name`);
  const publicPrivileges = await database.query(`with schemas as(
      select oid,nspname from pg_namespace where nspname in(select schema_name from runtime.moduleauthority union all select 'invoice' union all select 'public')
    )
    select 'schema:'||nspname object from schemas where has_schema_privilege('public',oid,'usage') or has_schema_privilege('public',oid,'create')
    union all
    select case relation.relkind when 'S' then 'sequence:' else 'table:' end||namespace.nspname||'.'||relation.relname
    from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.oid in(select oid from schemas) and relation.relkind in('r','p','v','m','S')
      and (has_table_privilege('public',relation.oid,'select') or has_table_privilege('public',relation.oid,'insert')
        or has_table_privilege('public',relation.oid,'update') or has_table_privilege('public',relation.oid,'delete'))
    union all
    select 'function:'||procedure.oid::regprocedure::text from pg_proc procedure
    where procedure.pronamespace in(select oid from schemas) and has_function_privilege('public',procedure.oid,'execute')
    order by object`);
  const unsafeRoles = await database.query(`select rolname from pg_roles where rolname in(
      select owner_role from runtime.moduleauthority union select reader_role from runtime.moduleauthority union select writer_role from runtime.moduleauthority
    ) and (rolcanlogin or rolbypassrls) order by rolname`);
  if (writerViolations.rows.length) throw new Error(`MODULE_WRITER_CROSS_SCHEMA:${writerViolations.rows[0].writer_role}:${writerViolations.rows[0].table_name}`);
  if (readerViolations.rows.length) throw new Error(`MODULE_READER_CAN_WRITE:${readerViolations.rows[0].role}:${readerViolations.rows[0].table_name}`);
  if (publicPrivileges.rows.length) throw new Error(`PUBLIC_DATABASE_PRIVILEGE:${publicPrivileges.rows[0].object}`);
  if (unsafeRoles.rows.length) throw new Error(`MODULE_ROLE_UNSAFE:${unsafeRoles.rows[0].rolname}`);
  return {
    status: 'passed',
    schemas: schemas.rows.length,
    moduleWriters: new Set(schemas.rows.map((row) => row.writer_role)).size,
    moduleReaders: new Set(schemas.rows.map((row) => row.reader_role)).size,
    writerCoverage: writerCoverage.rows,
    crossSchemaWrites: 0,
    readerWrites: 0,
    publicPrivileges: 0,
    unsafeRoles: 0,
  };
}

async function seedProviderHardcutUpgrade(database) {
  const mappings = [
    ['private', 'supplier', 'local'],
    ['directcharge', 'charge', 'health'],
    ['tmallmarket', 'tmall', 'health'],
  ];
  for (const [legacy, replacement, health] of mappings) {
    const legacyContract = legacy + '.v1';
    const replacementContract = replacement + '.v1';
    const legacyManifest = providerManifest(legacy, legacyContract, health);
    const replacementManifest = providerManifest(replacement, replacementContract, health);
    await database.query(
      `insert into extension.contractversion(extension_id,contract_version,schema_hash,status) values
        ($1,$2,$3,'verified'),($4,$5,$6,'verified')`,
      [legacy, legacyContract, digest('contract:' + legacy), replacement, replacementContract, digest('contract:' + replacement)]
    );
    await database.query(
      `insert into extension.manifest(id,version,kind,contract_version,manifest,manifest_hash,signature,registered_at) values
        ($1,'1.0.0','channel',$2,$3::jsonb,$4,$5,clock_timestamp()),
        ($6,'1.0.0','channel',$7,$8::jsonb,$9,$5,clock_timestamp())`,
      [legacy, legacyContract, JSON.stringify(legacyManifest), digest('manifest:' + legacy), 'c2lnbmVkLW1hbmlmZXN0', replacement, replacementContract, JSON.stringify(replacementManifest), digest('manifest:' + replacement)]
    );
    const local = legacy === 'private';
    await database.query(
      `insert into extension.installation(id,extension_id,extension_version,scope_id,status,manifest,base_url,endpoints,secret_ref,health_operation,installed_at)
      values($1,$2,'1.0.0',$3,'enabled',$4::jsonb,$5,$6::jsonb,$7,$8,clock_timestamp())`,
      [
        'extension:hardcut:' + legacy,
        legacy,
        'scope:hardcut:' + legacy,
        JSON.stringify(legacyManifest),
        local ? null : 'https://' + legacy + '.example.invalid',
        local ? '{}' : '{"health":"/health"}',
        local ? null : 'provider/' + legacy,
        health,
      ]
    );
    await database.query(
      `insert into channel.connection(id,provider,scope_id,status,contract_version,secret_ref,configuration,
        connection_timeout_ms,response_timeout_ms,total_deadline_ms,max_concurrency,requests_per_second,max_attempts,
        failure_threshold,recovery_ms,region)
      values($1,$2,$3,'enabled',$4,$5,'{}',1000,3000,5000,2,10,2,3,1000,'cn-test')`,
      ['connection:hardcut:' + legacy, legacy, 'scope:hardcut:' + legacy, legacyContract, local ? null : 'provider/' + legacy]
    );
  }
}

function providerManifest(id, contractVersion, healthOperation) {
  return {
    id,
    name: id,
    kind: 'channel',
    version: '1.0.0',
    apiVersion: '2026-08-21',
    contractVersion,
    dependencies: [],
    healthOperation,
    capabilities: ['Catalog'],
    permissions: ['channel.' + id + '.operate'],
    configSchema: 'provider.' + id + '.v1',
    eventSubscriptions: [],
    secretRefs: healthOperation === 'local' ? [] : ['credential'],
    sandbox: healthOperation === 'local'
      ? { supported: true, mode: 'local', endpointRef: null }
      : { supported: true, mode: 'endpoint', endpointRef: 'provider.' + id + '.sandboxurl' },
    rateLimits: { requestsPerSecond: 10, maxConcurrency: 2 },
    timeout: { connectionMs: 1000, responseMs: 3000, totalMs: 5000 },
    retryPolicy: { maxAttempts: 2 },
    circuitPolicy: { failureThreshold: 3, recoveryMs: 1000 },
    webhookContract: null,
    signature: 'c2lnbmVkLW1hbmlmZXN0',
  };
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function verifyMvpFusion(database) {
  const result = await database.query(`select
    (select count(*)::integer from pg_tables where schemaname='referral' and tablename in(
      'setting','product','member','binding','commission','commissionmovement','recoverymovement','withdrawalclaim')) referral_tables,
    (select count(*)::integer from pg_tables where schemaname='finance' and tablename in('repair','repairmovement')) repair_tables,
    (select count(*)::integer from pg_tables where schemaname='ordering' and tablename='receipt') receipt_tables,
    (select count(*)::integer from runtime.mvpauthority) mvp_authorities,
    (select count(*)::integer from runtime.migrationevidence where migration='20260830150000'
      and source_rows=target_rows and source_rows>=9) hardcut_evidence,
    (select count(*)::integer from pg_constraint constraintinfo
      join pg_class source on source.oid=constraintinfo.conrelid join pg_namespace source_namespace on source_namespace.oid=source.relnamespace
      join pg_class target on target.oid=constraintinfo.confrelid join pg_namespace target_namespace on target_namespace.oid=target.relnamespace
      where constraintinfo.contype='f' and source_namespace.nspname='referral' and target_namespace.nspname<>'referral') referral_cross_fks,
    (select count(*)::integer from extension.installation where extension_id in('private','directcharge','tmallmarket')
      or manifest->>'id' in('private','directcharge','tmallmarket')) legacy_installations,
    (select count(*)::integer from extension.manifest where id in('private','directcharge','tmallmarket')) legacy_manifests,
    (select count(*)::integer from extension.registry where extension_id in('private','directcharge','tmallmarket')) legacy_registry,
    (select count(*)::integer from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace
      where namespace.nspname='channel' and procedure.proname in('private_enabled','pull_private_catalog','pull_private_stock',
        'submit_private_order','cancel_private_order','pull_private_tracking','submit_private_refund','build_private_statement')) legacy_functions,
    (select count(*)::integer from extension.installation where id like 'extension:hardcut:%'
      and extension_id in('supplier','charge','tmall') and manifest->>'id'=extension_id) migrated_installations,
    (select count(*)::integer from extension.registry where installation_id like 'extension:hardcut:%'
      and extension_id in('supplier','charge','tmall')) migrated_registry,
    (select count(*)::integer from channel.connection where id like 'connection:hardcut:%'
      and provider in('supplier','charge','tmall')) migrated_connections,
    (select count(*)::integer from finance.journal journal where journal.state='posted' and
      (select coalesce(sum(case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end),0)
       from finance.entry entry where entry.journal_id=journal.id)<>0) unbalanced_journals`);
  const row = result.rows[0];
  if (
    JSON.stringify(row) !==
    JSON.stringify({
      referral_tables: 8,
      repair_tables: 2,
      receipt_tables: 1,
      mvp_authorities: 5,
      hardcut_evidence: 1,
      referral_cross_fks: 0,
      legacy_installations: 0,
      legacy_manifests: 0,
      legacy_registry: 0,
      legacy_functions: 0,
      migrated_installations: 3,
      migrated_registry: 3,
      migrated_connections: 3,
      unbalanced_journals: 0,
    })
  ) {
    throw new Error(`MVP_FUSION_DATABASE_INVALID:${JSON.stringify(row)}`);
  }
}

async function verifyZhudatuanRuntimeReadinessRepair(database) {
  const contract = await database.query(`select checksum from runtime.schemaversion
    where version='20260821032000'`);
  if (contract.rows[0]?.checksum !== '83892ce3a42c15ab21703902380b63b6cc3352000d0c4c2a9df50b60347e383a') {
    throw new Error(`ZHUDATUAN_RUNTIME_CONTRACT_CHECKSUM_INVALID:${JSON.stringify(contract.rows)}`);
  }
  const expectations = [
    ['zhudatuanidentityapi', ['20260821032000', '20260821054000', '20260828170000']],
    ['zhudatuanidentityjob', ['20260821032000', '20260821054000', '20260828170000']],
    ['zhudatuanbootstrap', ['20260828170000']],
  ];
  for (const [role, versions] of expectations) {
    await database.exec(`begin; set local role ${role};`);
    try {
      const visible = await database.query('select array_agg(version order by version) versions from runtime.schemaversion');
      if (JSON.stringify(visible.rows[0]?.versions) !== JSON.stringify(versions)) {
        throw new Error(`ZHUDATUAN_SCHEMA_VERSION_RLS_INVALID:${role}:${JSON.stringify(visible.rows[0])}`);
      }
    } finally {
      await database.exec('rollback');
    }
  }
}

async function verifyZhudatuanBootstrapRuntimeRepair(database) {
  const canonicalOwnerRole = await database.query(`select id,scope_id,status from access.role
    where id='role-platform-owner-v2'`);
  if (
    JSON.stringify(canonicalOwnerRole.rows) !==
    JSON.stringify([
      {
        id: 'role-platform-owner-v2',
        scope_id: 'tenant-zhudatuan',
        status: 'active',
      },
    ])
  )
    throw new Error(`ZHUDATUAN_BOOTSTRAP_OWNER_ROLE_INVALID:${JSON.stringify(canonicalOwnerRole.rows)}`);
  await database.exec(`begin;
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version) values
      ('principal:bootstrap-rls-legacy','active',1,clock_timestamp(),clock_timestamp(),0),
      ('principal:bootstrap-rls-canonical','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version) values
      ('member:bootstrap-rls-legacy','principal:bootstrap-rls-legacy','Legacy RLS Fixture','active',clock_timestamp(),clock_timestamp(),0),
      ('member:bootstrap-rls-canonical','principal:bootstrap-rls-canonical','Canonical RLS Fixture','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at) values
      ('membership:bootstrap-rls-legacy','member:bootstrap-rls-legacy','mall-demo','storefront','active',1,clock_timestamp()),
      ('membership:bootstrap-rls-canonical','member:bootstrap-rls-canonical','mall-zhudatuan','storefront','active',1,clock_timestamp());
    insert into access.membershiprole(membership_id,role_id,effective_at) values
      ('membership:bootstrap-rls-legacy','role-zhudatuan-storefront-member',clock_timestamp()),
      ('membership:bootstrap-rls-canonical','role-zhudatuan-storefront-member',clock_timestamp());
    set local role zhudatuanbootstrap;`);
  try {
    const result = await database.query(`select
      has_table_privilege(current_user,'identity.principal','SELECT') principal_read,
      has_table_privilege(current_user,'access.membership','SELECT') membership_read,
      has_table_privilege(current_user,'access.membershiprole','SELECT') membership_role_read,
      has_table_privilege(current_user,'identity.invitation','SELECT,INSERT') invite_read_create,
      has_table_privilege(current_user,'identity.principal','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') principal_write,
      has_table_privilege(current_user,'access.membership','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') membership_write,
      has_table_privilege(current_user,'access.membershiprole','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') membership_role_write,
      has_table_privilege(current_user,'identity.invitation','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') invite_mutate,
      (select array_agg(id order by id) from access.role where id in(
        'role-platform-owner-v2','role-zhudatuan-storefront-member','role:self')) visible_roles,
      (select count(*)::integer from access.membershiprole assignment
        join access.membership membership on membership.id=assignment.membership_id
        where assignment.role_id='role-zhudatuan-storefront-member'
          and membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')) legacy_assignments,
      (select array_agg(membership_id order by membership_id) from access.membershiprole
        where membership_id in('membership:bootstrap-rls-legacy','membership:bootstrap-rls-canonical')) fixture_assignments,
      (select count(*)::integer from identity.invitation where status='active' and (
        id='invite-demo-employee-2026' or organization_id in('tenant-smart-wing','enterprise-demo','mall-demo'))) legacy_invites,
      (select count(*)::integer from identity.principal
        where id='principal:zhudatuan:owner:ethan:v1') fixed_owner_principals,
      (select count(*)::integer from access.membership
        where id='membership-platform-owner-ethan-v1'
          and organization_id='tenant-zhudatuan' and client='operator') fixed_owner_memberships`);
    const row = result.rows[0];
    if (
      JSON.stringify(row) !==
      JSON.stringify({
        principal_read: true,
        membership_read: true,
        membership_role_read: true,
        invite_read_create: true,
        principal_write: false,
        membership_write: false,
        membership_role_write: false,
        invite_mutate: false,
        visible_roles: ['role-platform-owner-v2', 'role-zhudatuan-storefront-member', 'role:self'],
        legacy_assignments: 1,
        fixture_assignments: ['membership:bootstrap-rls-legacy'],
        legacy_invites: 0,
        fixed_owner_principals: 0,
        fixed_owner_memberships: 0,
      })
    ) {
      const policies = await database.query(`select policyname,permissive,roles,qual from pg_policies
        where schemaname='access' and tablename='role' order by policyname`);
      throw new Error(`ZHUDATUAN_BOOTSTRAP_RUNTIME_ACCESS_INVALID:${JSON.stringify({ row, policies: policies.rows })}`);
    }
  } finally {
    await database.exec('rollback');
  }
  if (mode === '--registration-fresh') {
    const boundary = await database.query(`select
      has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE') bootstrap_allowed,
      has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed`);
    if (JSON.stringify(boundary.rows[0]) !== JSON.stringify({ bootstrap_allowed: true, definer_allowed: true })) {
      throw new Error(`ZHUDATUAN_BOOTSTRAP_DEFINER_BOUNDARY_INVALID:${JSON.stringify(boundary.rows[0])}`);
    }
  }
}

async function verifyZhudatuanPurchaseAccess(database) {
  await database.exec(`begin;
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values('principal:purchase-rls','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values('member:purchase-rls','principal:purchase-rls','Purchase RLS','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values('membership:purchase-rls','member:purchase-rls','mall-zhudatuan','storefront','active',1,clock_timestamp());
    insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,user_agent,
      device_label,assurance_level,expires_at,last_seen_at,created_at)
    values('session:purchase-rls','principal:purchase-rls','membership:purchase-rls','${'6'.repeat(64)}',1,1,
      'storefront','${'7'.repeat(64)}','purchase-rls','purchase-rls',1,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp());
    insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values
      ('risk:purchase-ancestor','tenant-zhudatuan','Purchase ancestor','draft',1,clock_timestamp()),
      ('risk:purchase-unrelated','scope:purchase-unrelated','Purchase unrelated','draft',1,clock_timestamp());
    set local role zhudatuanpurchaseapi;
    select set_config('app.membership_id','membership:purchase-rls',true),
      set_config('app.actor_id','principal:purchase-rls',true),set_config('app.scope_id','mall-zhudatuan',true);`);
  try {
    const scopes = await database.query(`select
      access.purchase_member_allowed('member:purchase-rls') member_allowed,
      access.purchase_mall_allowed('mall-zhudatuan') mall_allowed,
      access.purchase_risk_scope_allowed('tenant-zhudatuan') ancestor_allowed,
      access.purchase_risk_scope_allowed('scope:purchase-unrelated') unrelated_allowed,
      has_schema_privilege(current_user,'finance','USAGE') finance_usage,
      has_schema_privilege(current_user,'voucher','USAGE') voucher_usage`);
    if (
      JSON.stringify(scopes.rows[0]) !==
      JSON.stringify({
        member_allowed: true,
        mall_allowed: true,
        ancestor_allowed: true,
        unrelated_allowed: false,
        finance_usage: false,
        voucher_usage: false,
      })
    )
      throw new Error(`ZHUDATUAN_PURCHASE_SCOPE_INVALID:${JSON.stringify(scopes.rows[0])}`);
    const visible = await database.query("select array_agg(id order by id) ids from risk.policy where id like 'risk:purchase-%'");
    if (JSON.stringify(visible.rows[0]?.ids) !== JSON.stringify(['risk:purchase-ancestor'])) {
      throw new Error(`ZHUDATUAN_PURCHASE_RISK_RLS_INVALID:${JSON.stringify(visible.rows[0])}`);
    }
    for (const expression of [
      "access.purchase_member_scope('membership:purchase-rls','session:purchase-rls')",
      "benefit.purchase_available('membership:purchase-rls','session:purchase-rls',array['benefit:none']::text[])",
      "benefit.purchase_reserve('membership:purchase-rls','session:purchase-rls','order:guard','member:purchase-rls',array['benefit:none']::text[],array[1]::bigint[])",
    ]) {
      await database.exec('savepoint direct_purchase_session_guard');
      let rejected = false;
      try {
        await database.query(`select * from ${expression}`);
      } catch (error) {
        rejected = String(error instanceof Error ? error.message : error).includes('PURCHASE_SESSION_INVALID');
      }
      await database.exec('rollback to savepoint direct_purchase_session_guard');
      if (!rejected) throw new Error(`ZHUDATUAN_PURCHASE_SET_ROLE_HELPER_ALLOWED:${expression}`);
    }
  } finally {
    await database.exec('rollback');
  }
}

async function verifyZhudatuanWebBusinessAccess(database) {
  await database.exec(`begin;
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values('principal:web-business-rls','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values('member:web-business-rls','principal:web-business-rls','Web Business RLS','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values('membership:web-business-rls','member:web-business-rls','mall-zhudatuan','storefront','active',1,clock_timestamp());
    insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,user_agent,
      device_label,assurance_level,expires_at,last_seen_at,created_at)
    values('session:web-business-rls','principal:web-business-rls','membership:web-business-rls','${'4'.repeat(64)}',1,1,
      'storefront','${'5'.repeat(64)}','web-business-rls','web-business-rls',1,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp());
    insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values
      ('risk:web-business-ancestor','tenant-zhudatuan','Web ancestor','draft',1,clock_timestamp()),
      ('risk:web-business-unrelated','scope:web-business-unrelated','Web unrelated','draft',1,clock_timestamp());
    insert into access.decisionaudit(id,actor_id,operation,resource_id,scope_id,decision,reason,policy_version,trace_id,decided_at) values
      ('decision:web-business-member','principal:web-business-rls','member.profile.read',null,'member:web-business-rls','allow','fixture','1','trace:web-business-member',clock_timestamp()),
      ('decision:web-business-ancestor','principal:web-business-rls','catalog.listings.read',null,'tenant-zhudatuan','allow','fixture','1','trace:web-business-ancestor',clock_timestamp()),
      ('decision:web-business-unrelated','principal:web-business-rls','catalog.listings.read',null,'scope:web-business-unrelated','allow','fixture','1','trace:web-business-unrelated',clock_timestamp()),
      ('decision:web-business-other-actor','principal:web-business-other','catalog.listings.read',null,'tenant-zhudatuan','allow','fixture','1','trace:web-business-other',clock_timestamp());
    set local role zhudatuanwebapi;
    select set_config('app.membership_id','membership:web-business-rls',true),
      set_config('app.actor_id','principal:web-business-rls',true),set_config('app.scope_id','mall-zhudatuan',true);`);
  try {
    const scopes = await database.query(`select
      access.web_scope_allowed('tenant-zhudatuan') business_ancestor,
      access.web_risk_scope_allowed('member:web-business-rls') risk_member,
      access.web_risk_scope_allowed('mall-zhudatuan') risk_mall,
      access.web_risk_scope_allowed('tenant-zhudatuan') risk_ancestor,
      access.web_risk_scope_allowed('scope:web-business-unrelated') risk_unrelated`);
    if (
      JSON.stringify(scopes.rows[0]) !==
      JSON.stringify({
        business_ancestor: false,
        risk_member: true,
        risk_mall: true,
        risk_ancestor: true,
        risk_unrelated: false,
      })
    ) {
      throw new Error(`ZHUDATUAN_WEB_RISK_SCOPE_INVALID:${JSON.stringify(scopes.rows[0])}`);
    }
    const visible = await database.query("select array_agg(id order by id) ids from risk.policy where id like 'risk:web-business-%'");
    if (JSON.stringify(visible.rows[0]?.ids) !== JSON.stringify(['risk:web-business-ancestor'])) {
      throw new Error(`ZHUDATUAN_WEB_RISK_RLS_INVALID:${JSON.stringify(visible.rows[0])}`);
    }
    const decisions = await database.query("select array_agg(id order by id) ids from access.decisionaudit where id like 'decision:web-business-%'");
    if (JSON.stringify(decisions.rows[0]?.ids) !== JSON.stringify(['decision:web-business-ancestor', 'decision:web-business-member'])) {
      throw new Error(`ZHUDATUAN_WEB_DECISION_VELOCITY_RLS_INVALID:${JSON.stringify(decisions.rows[0])}`);
    }
    for (const expression of [
      "access.web_member_scope('membership:web-business-rls','session:web-business-rls')",
      "access.web_storefront_scope('membership:web-business-rls','session:web-business-rls')",
      "benefit.web_account_balance('membership:web-business-rls','session:web-business-rls')",
    ]) {
      await database.exec('savepoint direct_session_guard');
      let rejected = false;
      try {
        await database.query(`select * from ${expression}`);
      } catch (error) {
        rejected = String(error instanceof Error ? error.message : error).includes('WEB_');
      }
      await database.exec('rollback to savepoint direct_session_guard');
      if (!rejected) throw new Error(`ZHUDATUAN_WEB_SET_ROLE_HELPER_ALLOWED:${expression}`);
    }
  } finally {
    await database.exec('rollback');
  }
}

async function verifyZhudatuanRegistrationBaseline(database) {
  const beforeReplay = await zhudatuanRegistrationFingerprint(database);
  const baseline = await database.query(`select
    (select count(*)::integer from organization.organization
      where id in('tenant-zhudatuan','enterprise-zhudatuan','mall-zhudatuan') and status='active') organizations,
    (select count(*)::integer from identity.registrationpolicy
      where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp())) active_policies,
    (select count(*)::integer from identity.registrationpolicy
      where id='registration:zhudatuan:2026-08-28-v1'
        and terms_hash='207450deff7c7baece6af24957ff48adf3393532a5d37b6f8d369370253e557d'
        and retired_at is null) canonical_policy,
    (select count(*)::integer from identity.invitation
      where status='active' and (id='invite-demo-employee-2026'
        or organization_id in('tenant-smart-wing','enterprise-demo','mall-demo'))) legacy_invites,
    (select count(*)::integer from access.membership membership join member.profile profile on profile.id=membership.member_id
      join identity.principal principal on principal.id=profile.principal_id
      where membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
        and (membership.status in('active','invited') or profile.status='active' or principal.status='active')) legacy_employee_assignments,
    (select count(*)::integer from access.role
      where id='role-zhudatuan-storefront-member' and scope_id='mall-zhudatuan' and status='active') employee_role,
    (select count(*)::integer from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role-zhudatuan-storefront-member' and mapping.effect='allow' and permission.code in(
        'catalog.listing.read','pricing.offer.read','inventory.read','cart.read','cart.manage','checkout.create','order.create',
        'order.read','order.aftersale.apply','payment.create','benefit.read','voucher.binding.read','support.case.create',
        'observability.clienterror.create')) employee_permissions,
    (select count(*)::integer from audit.record
      where id='audit:zhudatuan:registration-baseline:v1' and action='identity.registration.baseline.established') audit_records`);
  const row = baseline.rows[0];
  if (JSON.stringify(row) !== JSON.stringify({ organizations: 3, active_policies: 1, canonical_policy: 1, legacy_invites: 0, legacy_employee_assignments: 0, employee_role: 1, employee_permissions: 14, audit_records: 1 })) {
    throw new Error(`ZHUDATUAN_REGISTRATION_BASELINE_INVALID:${JSON.stringify(row)}`);
  }
  await verifyPhoneAssuranceRevocation(database);
  await execute(database, await readFile(join(MIGRATIONS, '20260828170000_zhudatuan_registration_baseline.sql'), 'utf8'), 'idempotent zhudatuan registration baseline replay');
  const afterReplay = await zhudatuanRegistrationFingerprint(database);
  if (JSON.stringify(afterReplay) !== JSON.stringify(beforeReplay)) {
    throw new Error(`ZHUDATUAN_REGISTRATION_BASELINE_NOT_IDEMPOTENT:${JSON.stringify({ beforeReplay, afterReplay })}`);
  }
  // The historical baseline intentionally recreates its original policies.
  // Restore the immutable forward repair before any current-head ACL checks.
  const bootstrapRepair = await readFile(join(MIGRATIONS, REGISTRATION_BOOTSTRAP_REPAIR), 'utf8');
  await execute(database, omitExactEnvironmentAssertion(bootstrapRepair, REGISTRATION_BOOTSTRAP_REPLAY_FUTURE_HEAD_ASSERTION, REGISTRATION_BOOTSTRAP_REPAIR), 'idempotent zhudatuan registration bootstrap repair replay');
  await execute(database, await readFile(join(MIGRATIONS, '20260829054500_zhudatuan_identity_login_acl_repair.sql'), 'utf8'), 'idempotent zhudatuan identity login ACL repair replay');
}

async function verifyPhoneAssuranceRevocation(database) {
  const token = '7'.repeat(64);
  await database.exec(`begin;
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values('principal:registration-assurance-replay','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values('member:registration-assurance-replay','principal:registration-assurance-replay','Assurance Replay','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values('membership:registration-assurance-replay','member:registration-assurance-replay','mall-zhudatuan','storefront','active',1,clock_timestamp());
    insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,user_agent,
      device_label,assurance_level,expires_at,last_seen_at,created_at)
    values('session:registration-assurance-replay','principal:registration-assurance-replay','membership:registration-assurance-replay',
      '${token}',1,1,'storefront','${'8'.repeat(64)}','fresh-replay','fresh-replay',2,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp());
    insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
    values('assurance:registration-assurance-replay','principal:registration-assurance-replay','phone_otp',2,'${'9'.repeat(64)}',
      clock_timestamp(),clock_timestamp()+interval '1 hour');`);
  try {
    const active = await database.query('select assurance_level from identity.resolve_session($1)', [token]);
    if (active.rows[0]?.assurance_level !== 2) throw new Error(`PHONE_ASSURANCE_ACTIVE_INVALID:${JSON.stringify(active.rows)}`);
    await database.query("update identity.assurance set expires_at=clock_timestamp() where id='assurance:registration-assurance-replay'");
    const expired = await database.query('select assurance_level from identity.resolve_session($1)', [token]);
    if (expired.rows[0]?.assurance_level !== 1) throw new Error(`PHONE_ASSURANCE_REVOCATION_INVALID:${JSON.stringify(expired.rows)}`);
  } finally {
    await database.exec('rollback');
  }
}

async function zhudatuanRegistrationFingerprint(database) {
  const result = await database.query(`select
    (select coalesce(sum(version),0)::text from organization.organization
      where id in('tenant-zhudatuan','enterprise-zhudatuan','mall-zhudatuan')) organization_versions,
    (select coalesce(sum(version),0)::text from identity.registrationpolicy
      where id in('registration:2026-08-13','registration:zhudatuan:2026-08-28-v1')) policy_versions,
    (select coalesce(sum(version),0)::text from access.role where id='role-zhudatuan-storefront-member') role_versions,
    (select coalesce(sum(version),0)::text from identity.invitation
      where id='invite-demo-employee-2026') legacy_invitation_versions,
    (select count(*)::integer from audit.record where id like 'audit:zhudatuan:registration-baseline:%') audit_records,
    (select count(*)::integer from access.membership membership join member.profile profile on profile.id=membership.member_id
      join identity.principal principal on principal.id=profile.principal_id
      where membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
        and (membership.status in('active','invited') or profile.status='active' or principal.status='active')) unexpired_legacy_assignments`);
  return result.rows[0];
}

async function verifyExtensionLifecycle(database) {
  const hash = 'c'.repeat(64);
  const manifest = JSON.stringify({
    id: 'replayprovider',
    kind: 'channel',
    version: '1.0.0',
    apiVersion: '2026-08-21',
    contractVersion: 'replay.v1',
    healthOperation: 'local',
    capabilities: ['Catalog'],
    permissions: [],
    configSchema: 'replay.v1',
    eventSubscriptions: [],
    secretRefs: [],
    limits: { connectionTimeoutMs: 1, responseTimeoutMs: 1, totalDeadlineMs: 1, maxConcurrency: 1, requestsPerSecond: 1, maxAttempts: 1, failureThreshold: 1, recoveryMs: 100 },
    signature: 'c2lnbmVk',
  });
  await database.query(
    `insert into extension.manifest(id,version,kind,contract_version,manifest,manifest_hash,signature,registered_at)
    values('replayprovider','1.0.0','channel','replay.v1',$1::jsonb,$2,'c2lnbmVk',clock_timestamp());`,
    [manifest, hash]
  );
  await database.exec(`insert into extension.contractversion(extension_id,contract_version,schema_hash,status)
    values('replayprovider','replay.v1','${hash}','verified');
    insert into extension.installation(id,extension_id,extension_version,scope_id,status,manifest,base_url,endpoints,secret_ref,health_operation,installed_at)
    values('extension:replay-active','replayprovider','1.0.0','rls-scope-a','enabled','${manifest}'::jsonb,'https://replay.invalid','{"local":"/health"}','secret/replay','local',clock_timestamp()),
      ('extension:replay-candidate','replayprovider','1.0.0','rls-scope-a','testing','${manifest}'::jsonb,'https://replay.invalid','{"local":"/health"}','secret/replay','local',clock_timestamp());`);
  let uniqueRejected = false;
  try {
    await database.exec("update extension.installation set status='enabled' where id='extension:replay-candidate'");
  } catch (error) {
    if (
      !String(error instanceof Error ? error.message : error)
        .toLowerCase()
        .includes('unique')
    )
      throw error;
    uniqueRejected = true;
  }
  if (!uniqueRejected) throw new Error('EXTENSION_SINGLE_ACTIVE_CONSTRAINT_MISSING');
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),
    set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','extension-auditor',true);`);
  const visible = await database.query("select id from extension.load_installation('extension:replay-candidate','rls-scope-a')");
  const manifestVisible = await database.query("select count(*)::integer count from extension.manifest where id='replayprovider'");
  await database.exec('commit');
  if (visible.rows[0]?.id !== 'extension:replay-candidate' || manifestVisible.rows[0]?.count !== 1) throw new Error('EXTENSION_SCOPE_POLICY_INVALID');
  let mutationRejected = false;
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true);`);
  try {
    await database.query("update extension.manifest set signature='forged' where id='replayprovider'");
  } catch (error) {
    if (
      !String(error instanceof Error ? error.message : error)
        .toLowerCase()
        .includes('permission')
    )
      throw error;
    mutationRejected = true;
  }
  await database.exec('rollback');
  if (!mutationRejected) throw new Error('EXTENSION_MANIFEST_MUTATION_ALLOWED');
}

async function verifyAuditImmutability(database) {
  const hash = 'b'.repeat(64);
  await database.exec(`insert into audit.record(id,scope_id,actor_id,actor_type,request_id,operation,subject_type,subject_id,object_type,
    object_id,outcome,reason,before_hash,after_hash,evidence,trace_id,previous_hash,record_hash,recorded_at)
    values('audit:immutability','organization-platform-root','audit-test','system','request:audit-immutability','audit.test','system',
    'audit-test','audit','audit:immutability','succeeded','immutability-verification',null,null,'{}','audit:test',null,'${hash}',clock_timestamp());`);
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),
    set_config('app.scope_id','organization-platform-root',true);`);
  let rejected = false;
  let changed = 0;
  try {
    changed = (await database.query("update audit.record set operation='mutated' where id='audit:immutability'")).rowCount ?? 0;
  } catch (error) {
    if (!/(?:AUDIT_IMMUTABLE|permission denied)/i.test(String(error instanceof Error ? error.message : error))) throw error;
    rejected = true;
  }
  await database.exec('rollback');
  if (!rejected && changed !== 0) throw new Error('AUDIT_UPDATE_WAS_NOT_REJECTED');
  const unchanged = await database.query("select operation from audit.record where id='audit:immutability'");
  if (unchanged.rows[0]?.operation !== 'audit.test') throw new Error('AUDIT_UPDATE_IMMUTABILITY_INVALID');
  await database.exec(`begin; set local role shopjob; select set_config('app.workload','jobs',true);`);
  let deleteRejected = false;
  try {
    await database.query("delete from audit.record where id='audit:immutability'");
  } catch (error) {
    if (!/(?:AUDIT_IMMUTABLE|permission denied)/i.test(String(error instanceof Error ? error.message : error))) throw error;
    deleteRejected = true;
  }
  await database.exec('rollback');
  const retained = await database.query("select count(*)::integer count from audit.record where id='audit:immutability'");
  if (!deleteRejected || retained.rows[0]?.count !== 1) throw new Error('AUDIT_PHYSICAL_DELETE_NOT_REJECTED');
}

async function verifyRls(database) {
  await database.exec(`insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values
    ('rls-policy-a','rls-scope-a','RLS A','draft',1,clock_timestamp()),('rls-policy-b','rls-scope-b','RLS B','draft',1,clock_timestamp());`);
  await database.exec(`begin; set local role shopapp;
    select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','rls-auditor',true);`);
  const visible = await database.query("select array_agg(id order by id) ids from risk.policy where id like 'rls-policy-%'");
  await database.exec('commit');
  if (JSON.stringify(visible.rows[0]?.ids) !== JSON.stringify(['rls-policy-a'])) throw new Error('RLS_SCOPE_READ_ISOLATION_INVALID');
  await database.exec(`begin; set local role shopapp;
    select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','rls-auditor',true);`);
  try {
    await database.query("insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values('rls-policy-forbidden','rls-scope-b','forbidden','draft',1,clock_timestamp())");
  } catch (error) {
    await database.exec('rollback');
    if (
      !String(error instanceof Error ? error.message : error)
        .toLowerCase()
        .includes('row-level security')
    )
      throw error;
    return;
  }
  await database.exec('rollback');
  throw new Error('RLS_SCOPE_WRITE_ISOLATION_INVALID');
}

async function verifyObjectContract(database) {
  const contract = parse(await readFile(OBJECTS, 'utf8'));
  const entries = Array.isArray(contract?.objects) ? contract.objects : [];
  const auditedRoles = new Set(['shopapp', 'shopjob', 'shopread']);
  const schemas = entries
    .filter((entry) => entry.kind === 'schema')
    .map((entry) => entry.id)
    .sort();
  const expected = new Map([
    ['schema', new Set(schemas)],
    ['table', new Set(entries.filter((entry) => entry.kind === 'table').map((entry) => entry.id))],
    ['view', new Set(entries.filter((entry) => entry.kind === 'view').map((entry) => entry.id))],
    ['function', new Set(entries.filter((entry) => entry.kind === 'function').map((entry) => entry.id))],
    ['trigger', new Set(entries.filter((entry) => entry.kind === 'trigger').map((entry) => entry.id))],
    ['policy', new Set(entries.filter((entry) => entry.kind === 'policy').map((entry) => entry.id))],
  ]);
  const schemaRows = await database.query(
    `select namespace.nspname id,namespace.nspowner::regrole::text owner
    from pg_namespace namespace where namespace.nspname=any($1::text[])`,
    [schemas]
  );
  const tableRows = await database.query(
    `select namespace.nspname||'.'||relation.relname id,relation.relrowsecurity rls,relation.relowner::regrole::text owner
    from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname=any($1::text[]) and relation.relkind in('r','p')`,
    [schemas]
  );
  const viewRows = await database.query(
    `select namespace.nspname||'.'||relation.relname id,relation.relowner::regrole::text owner from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname=any($1::text[]) and relation.relkind in('v','m')`,
    [schemas]
  );
  const functionRows = await database.query(
    `select namespace.nspname||'.'||procedure.proname id,replace(procedure.oid::regprocedure::text,' ','') signature,
      procedure.proowner::regrole::text owner from pg_proc procedure
    join pg_namespace namespace on namespace.oid=procedure.pronamespace where namespace.nspname=any($1::text[])`,
    [schemas]
  );
  const triggerRows = await database.query(
    `select namespace.nspname||'.'||relation.relname||'.'||trigger.tgname id from pg_trigger trigger
    join pg_class relation on relation.oid=trigger.tgrelid join pg_namespace namespace on namespace.oid=relation.relnamespace
    where not trigger.tgisinternal and namespace.nspname=any($1::text[])`,
    [schemas]
  );
  const policyRows = await database.query(`select schemaname||'.'||tablename||'.'||policyname id from pg_policies where schemaname=any($1::text[])`, [schemas]);
  const ownership = new Map([
    ...schemaRows.rows.map((row) => [`schema:${row.id}`, row.owner]),
    ...tableRows.rows.map((row) => [`table:${row.id}`, row.owner]),
    ...viewRows.rows.map((row) => [`view:${row.id}`, row.owner]),
    ...functionRows.rows.map((row) => [`function:${row.signature}`, row.owner]),
  ]);
  expected.set(
    'grant',
    new Set(
      entries
        .filter((entry) => entry.kind === 'grant')
        .filter((entry) => auditedRoles.has(entry.role))
        .filter((entry) => ownership.get(`${entry.objectType}:${entry.target}`) !== entry.role)
        .map((entry) => entry.id)
    )
  );
  compareSet(
    'schema',
    expected.get('schema'),
    schemaRows.rows.map((row) => row.id)
  );
  compareSet(
    'table',
    expected.get('table'),
    tableRows.rows.map((row) => row.id)
  );
  compareSet(
    'view',
    expected.get('view'),
    viewRows.rows.map((row) => row.id)
  );
  compareSet(
    'function',
    expected.get('function'),
    functionRows.rows.map((row) => row.id)
  );
  compareSet(
    'trigger',
    expected.get('trigger'),
    triggerRows.rows.map((row) => row.id)
  );
  compareSet(
    'policy',
    expected.get('policy'),
    policyRows.rows.map((row) => row.id)
  );
  const unprotectedTables = tableRows.rows.filter((row) => !row.rls).map((row) => row.id);
  if (unprotectedTables.length > 0) throw new Error(`DATABASE_OBJECT_RLS_DRIFT:${JSON.stringify(unprotectedTables)}`);

  const roleRows = await database.query(
    `with roles(role) as (values('shopapp'),('shopjob'),('shopread')),
    table_privilege(privilege) as (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')),
    schema_privilege(privilege) as (values('USAGE'),('CREATE')),
    schemas as (select namespace.nspname schema,namespace.nspowner::regrole::text owner
      from pg_namespace namespace where namespace.nspname=any($1::text[])),
    tables as (select schemaname,tablename,tableowner owner from pg_tables where schemaname=any($1::text[])),
    views as (select schemaname,viewname,viewowner owner from pg_views where schemaname=any($1::text[])),
    functions as (select procedure.oid,procedure.oid::regprocedure::text signature,procedure.proowner::regrole::text owner
      from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace where namespace.nspname=any($1::text[]))
    select role||':schema:'||schema||':'||lower(privilege) id from roles cross join schemas cross join schema_privilege
      where role<>owner and has_schema_privilege(role,schema,privilege)
    union all
    select role||':table:'||schemaname||'.'||tablename||':'||lower(privilege) from roles cross join tables cross join table_privilege
      where role<>owner and has_table_privilege(role,schemaname||'.'||tablename,privilege)
    union all
    select role||':view:'||schemaname||'.'||viewname||':'||lower(privilege) from roles cross join views cross join table_privilege
      where role<>owner and has_table_privilege(role,schemaname||'.'||viewname,privilege)
    union all
    select role||':function:'||replace(signature,' ','')||':execute' from roles cross join functions
      where role<>owner and has_function_privilege(role,oid,'EXECUTE')`,
    [schemas]
  );
  compareSet(
    'grant',
    expected.get('grant'),
    roleRows.rows.map((row) => row.id)
  );
}

function compareSet(kind, expected, actualValues) {
  const actual = new Set(actualValues);
  const missing = [...expected].filter((value) => !actual.has(value)).sort();
  const extra = [...actual].filter((value) => !expected.has(value)).sort();
  if (missing.length || extra.length) throw new Error(`DATABASE_OBJECT_${kind.toUpperCase()}_DRIFT:${JSON.stringify({ missing, extra })}`);
}
