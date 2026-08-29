import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { Client } from 'pg';
import { parse } from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const ROOT = repositoryRoot;
const MIGRATIONS = join(ROOT, 'database', 'supabase', 'migrations');
const HISTORY = join(ROOT, 'database', 'contracts', 'history.json');
const OBJECTS = join(ROOT, 'database', 'contracts', 'objects.yml');
const SANDBOX_CATALOG = join(ROOT, 'tools', 'seed', 'src', 'SandboxCatalogDatabase.sql');
const REGISTRATION_BOUNDARY_RECONCILE = join(
  ROOT,
  'infrastructure',
  'zhudatuan',
  'aliyun',
  'postgres-reconcile-registration-boundary.sql',
);
const BOOTSTRAP = '20260817191000_bootstrap_ethan_platform_owner.sql';
const OWNER_RECONCILIATION = '20260820132000_platform_owner_reconciliation.sql';
const INVITATION_SCOPE = '20260821066000_resolve_invitation_scope.sql';
const REGISTRATION_BOOTSTRAP_REPAIR = '20260829040000_zhudatuan_registration_bootstrap_runtime_repair.sql';
const REGISTRATION_BOOTSTRAP_REPLAY_FUTURE_HEAD_ASSERTION = /\n  if exists\(select 1 from runtime\.schemaversion\n    where version>'20260828183000' and version<>'20260829040000'\) then\n    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_REPAIR_FUTURE_HEAD_INVALID';\n  end if;/;
const IDENTITY_LOGIN_ACL_REPAIR = '20260829054500_zhudatuan_identity_login_acl_repair.sql';
const OPERATOR_INVITATION_CONTRACT = join(ROOT,'database','supabase','tests','zhudatuan_operator_invitation_registration_contract.sql');
const IDENTITY_LOGIN_ACL_REPLAY_FUTURE_HEAD_ASSERTION = /\n  if exists\(select 1 from runtime\.schemaversion\n    where version>'20260829040000' and version<>'20260829054500'\) then\n    raise exception 'ZHUDATUAN_IDENTITY_LOGIN_ACL_FUTURE_HEAD_INVALID';\n  end if;/;
const OPERATOR_INVITATION_REGISTRATION = '20260829060000_zhudatuan_operator_invitation_registration.sql';
const OPERATOR_INVITATION_REPLAY_FUTURE_HEAD_ASSERTION = /\n  if exists\(select 1 from runtime\.schemaversion\n    where version>'20260829054500' and version<>'20260829060000'\) then\n    raise exception 'ZHUDATUAN_OPERATOR_INVITATION_FUTURE_HEAD_INVALID';\n  end if;/;
const OWNER_OPERATOR_COVERAGE = '20260829210000_owner_operator_coverage.sql';
const PLATFORM_OWNER_TRANSFER = '20260829211000_platform_owner_transfer.sql';
const OWNER_OPERATOR_COVERAGE_BOUNDARY_GUARD = /do \$boundary_guard\$[\s\S]*?\n\$boundary_guard\$;/;
const OWNER_OPERATOR_COVERAGE_OPTIONAL_STAGING_ASSERTION = /\n  if exists\(select 1 from runtime\.schemaversion\n    where version='20260829060000'\n      and checksum<>'b1e238eb8de569b0de9d1d2766620e1f661268d2f9260e646208d4f24715b37a'\) then\n    raise exception 'OWNER_OPERATOR_COVERAGE_OPTIONAL_PREDECESSOR_INVALID';\n  end if;\n  if exists\(select 1 from runtime\.schemaversion\n    where version>'20260829054500'\n      and version not in\('20260829060000','20260829210000'\)\) then\n    raise exception 'OWNER_OPERATOR_COVERAGE_FUTURE_HEAD_INVALID';\n  end if;/;
const OWNER_RUNTIME_BOUNDARY_HARDENING = '20260829212000_owner_runtime_boundary_hardening.sql';
const REGISTRATION_ASSERTION_OMISSIONS = new Map([
  [INVITATION_SCOPE,/\ndo \$assert\$ begin\n  if access\.resource_scope\('identity\.invitations\.create',[\s\S]*?\nend \$assert\$;\n/],
  ['20260821069000_add_store_management.sql',/\n  select id into membership from access\.membership[\s\S]*?STORE_CREATE_SCOPE_UNRESOLVED'; end if;\n/],
  ['20260821074000_grant_platform_owner_operations.sql',/\ndo \$assert\$[\s\S]*?\n\$assert\$;\n/],
  ['20260821075000_grant_platform_cardlibrary_read.sql',/\ndo \$assert\$[\s\S]*?\nend \$assert\$;\n/],
  ['20260821076000_grant_platform_cockpit_reads.sql',/\ndo \$assert\$[\s\S]*?\n\$assert\$;\n/],
  ['20260821078000_complete_experience_application.sql',/\n  if exists\(\n    select 1 from unnest\(required_operations\)[\s\S]*?PLATFORM_OWNER_EXPERIENCE_OPERATION_MISSING';\n  end if;\n/],
]);
const INVENTORY_CUTOVER = '20260820133000_inventory_single_source_cutover.sql';
const SECURE_STAGE = '20260821026000_backfill_domain_data.sql';
const REPAIR_FILES = [
  '20260821010000_assert_source_head.sql','20260821011000_create_domain_schemas.sql','20260821012000_create_runtime_control.sql',
  '20260821013000_create_identity_access.sql','20260821014000_create_organization_partner.sql','20260821015000_create_capability_member.sql',
  '20260821016000_create_qualification.sql','20260821017000_create_catalog_pricing.sql','20260821018000_create_inventory_experience.sql',
  '20260821019000_create_cart_checkout_order.sql','20260821020000_create_fulfillment_verification.sql','20260821021000_create_payment_voucher_benefit.sql',
  '20260821022000_create_finance_channel.sql','20260821023000_create_support_notification.sql','20260821024000_create_reporting_risk_audit.sql',
  '20260821025000_create_extension.sql','20260821026000_backfill_domain_data.sql','20260821027000_reconcile_domain_data.sql',
  '20260821028000_build_domain_indexes.sql','20260821029000_publish_domain_contract.sql','20260821030000_revoke_public_access.sql',
  '20260821031000_drop_legacy_objects.sql','20260821032000_assert_target_head.sql','20260821033000_complete_experience_publication.sql',
  '20260821034000_add_storefront_offer_read.sql','20260821035000_add_auth_ticket_exchange.sql',
  '20260821036000_add_invitation_terms_read.sql','20260821037000_add_member_journey.sql','20260821038000_add_keyset_indexes.sql',
  '20260821039000_checkout_atomic_order.sql','20260821040000_payment_recovery.sql','20260821041000_voucher_lifecycle.sql','20260821042000_benefit_lifecycle.sql',
  '20260821043000_finance_lifecycle.sql',
  '20260821044000_channel_lifecycle.sql',
  '20260821045000_channel_scope_mapping.sql',
  '20260821046000_support_lifecycle.sql',
  '20260821047000_notification_lifecycle.sql',
  '20260821048000_reporting_lifecycle.sql',
  '20260821049000_risk_lifecycle.sql',
  '20260821050000_audit_lifecycle.sql',
  '20260821051000_extension_lifecycle.sql',
  '20260821052000_import_lifecycle.sql',
  '20260821053000_complete_batch_imports.sql',
  '20260821054000_move_membership_owner.sql',
  '20260821055000_isolate_wechat_payment_applications.sql',
  '20260821056000_authorize_member_data_scope.sql',
  '20260821057000_resolve_payment_webhook_scope.sql',
  '20260821058000_align_member_operations.sql',
  '20260821059000_reconcile_contract_head.sql',
  '20260821060000_rebind_membership_functions.sql',
  '20260821061000_normalize_membership_scopes.sql',
  '20260821062000_publish_error_contract.sql',
  '20260821063000_finalize_error_contract.sql',
  '20260821064000_add_client_error_telemetry.sql',
  '20260821065000_add_invitation_lifecycle.sql',
  '20260821066000_resolve_invitation_scope.sql',
  '20260821067000_add_session_management.sql',
  '20260821068000_add_member_benefit_ledger.sql',
  '20260821069000_add_store_management.sql',
  '20260821070000_repair_decision_audit_scope.sql',
  '20260821071000_grant_store_administration.sql',
  '20260821072000_add_console_member_commands.sql',
  '20260821073000_publish_console_contract.sql',
  '20260821074000_grant_platform_owner_operations.sql',
  '20260821075000_grant_platform_cardlibrary_read.sql',
  '20260821076000_grant_platform_cockpit_reads.sql',
  '20260821077000_add_reporting_cockpit.sql',
  '20260821078000_complete_experience_application.sql',
  '20260821079000_resolve_experience_version_scope.sql',
  '20260821080000_restore_member_scope_authorization.sql',
  '20260828170000_zhudatuan_registration_baseline.sql',
  '20260828173000_zhudatuan_web_business_access.sql',
  '20260828180000_zhudatuan_purchase_access.sql',
  '20260828183000_zhudatuan_runtime_readiness_repair.sql',
  '20260829040000_zhudatuan_registration_bootstrap_runtime_repair.sql',
  '20260829054500_zhudatuan_identity_login_acl_repair.sql',
  OPERATOR_INVITATION_REGISTRATION,
  OWNER_OPERATOR_COVERAGE,
  PLATFORM_OWNER_TRANSFER,
  OWNER_RUNTIME_BOUNDARY_HARDENING,
];

const mode = process.argv[2];
if (!['--check-inventory','--schema-fresh','--registration-fresh','--registration-boundary-postgres','--environment-bootstrap','--inventory-cutover-unsafe','--postgres-fresh','--mvp-kernel','--owner-coverage','--owner-transfer'].includes(mode)) {
  throw new Error('usage: database-contracts.mjs --check-inventory|--schema-fresh|--registration-fresh|--registration-boundary-postgres|--environment-bootstrap|--inventory-cutover-unsafe|--postgres-fresh|--mvp-kernel|--owner-coverage|--owner-transfer [URL]');
}
const replayRole = mode === '--postgres-fresh' ? process.argv[4] : undefined;
if (replayRole !== undefined && !/^[a-z][a-z0-9_]{2,62}$/.test(replayRole)) throw new Error('POSTGRES_FRESH_ROLE_INVALID');
if (mode === '--registration-boundary-postgres' && process.argv[4] !== 'local-disposable-fixture') {
  throw new Error('REGISTRATION_BOUNDARY_POSTGRES_FIXTURE_CONFIRMATION_REQUIRED');
}

const migrationFiles = (await readdir(MIGRATIONS)).filter((name) => name.endsWith('.sql')).sort();
const expectedRepairFiles = REPAIR_FILES.filter((name) => name!==OPERATOR_INVITATION_REGISTRATION
  || migrationFiles.includes(OPERATOR_INVITATION_REGISTRATION));
await verifyInventory(migrationFiles);
if (mode === '--check-inventory') {
  console.log(`migration inventory ok: historical=94 repair=${expectedRepairFiles.length} total=${migrationFiles.length}`);
  process.exit(0);
}

if (mode === '--registration-boundary-postgres') {
  const database = await openDatabase();
  try {
    await verifyRegistrationBoundaryOnPostgres(database);
  } finally {
    await database.close();
  }
  console.log('registration boundary PostgreSQL replay passed: rds-like-deny=1 rds-like-allow=2 legacy-upgrade=1');
  process.exit(0);
}

const database = await openDatabase();
try {
  await execute(database, `
    create role anon nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    create role authenticated nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    create role service_role nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  `, 'database role bootstrap');
  if (mode === '--registration-fresh' || mode === '--owner-transfer') await installRegistrationReplayBoundary(database);
  if (replayRole !== undefined) await execute(database, `set role "${replayRole}"`, 'database migration role');
  await execute(database, `
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
  `, 'database bootstrap');
  let applied = 0;
  for (const name of migrationFiles) {
    if (mode === '--registration-fresh' && (name === BOOTSTRAP || name === OWNER_RECONCILIATION)) {
      await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)',
        [name.slice(0,14),`environment-omitted:${name}`]);
      applied += 1;
      continue;
    }
    if (name === BOOTSTRAP) await seedBootstrapPrecondition(database);
    if (mode === '--owner-transfer' && name === PLATFORM_OWNER_TRANSFER) {
      await seedPlatformOwnerTransferPrecondition(database);
    }
    if (mode === '--inventory-cutover-unsafe' && name === INVENTORY_CUTOVER) {
      await seedUnsafeInventoryCutover(database);
      await assertUnsafeInventoryCutoverRejected(database, await readFile(join(MIGRATIONS,name),'utf8'));
      console.log(`unsafe inventory cutover rejected atomically: migrations_before_cutover=${applied}`);
      process.exitCode = 0;
      break;
    }
    if (name === SECURE_STAGE) await stageFreshReplaySecrets(database);
    const source = await readFile(join(MIGRATIONS,name),'utf8');
    const omission=REGISTRATION_ASSERTION_OMISSIONS.get(name);
    const sql = mode==='--registration-fresh' && omission
      ? omitExactEnvironmentAssertion(source,omission,name)
      : source;
    await execute(database, sql, `migration ${name}`);
    await database.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)', [name.slice(0,14),name]);
    applied += 1;
  }
  if (mode !== '--inventory-cutover-unsafe') {
    if (mode === '--registration-fresh' || mode === '--owner-transfer') await reconcileRegistrationReplayBoundary(database);
    if (mode === '--owner-coverage') await verifyOwnerOperatorCoverage(database);
    else if (mode === '--owner-transfer') await verifyPlatformOwnerTransfer(database);
    else await verifyTarget(database);
    if (mode === '--mvp-kernel') {
      const { verifyMvpKernel } = await import('./mvp-kernel.mjs');
      await verifyMvpKernel(database);
    }
    const replayLabel=mode==='--owner-coverage' ? 'owner coverage' : mode==='--owner-transfer' ? 'owner transfer' : 'target schema';
    console.log(`${replayLabel} replay passed: migrations=${applied} historical=94 repair=${expectedRepairFiles.length}`);
  }
} finally {
  await database.close();
}

async function openDatabase() {
  if (mode !== '--postgres-fresh' && mode !== '--registration-boundary-postgres') {
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
  if (mode === '--registration-boundary-postgres' && connectionString === undefined) {
    throw new Error('REGISTRATION_BOUNDARY_POSTGRES_URL_REQUIRED');
  }
  const client = new Client({ ...(connectionString === undefined ? {} : { connectionString }), connectionTimeoutMillis: 5_000, statement_timeout: 120_000 });
  await client.connect();
  return Object.freeze({
    exec: async (sql) => { await client.query(sql); },
    query: (sql, parameters) => client.query(sql, parameters),
    close: () => client.end(),
  });
}

async function verifyInventory(files) {
  const duplicates = duplicateVersions(files);
  if (duplicates.size) throw new Error(`duplicate migration versions: ${JSON.stringify([...duplicates])}`);
  const history = JSON.parse(await readFile(HISTORY,'utf8'));
  if (history.algorithm!=='sha256' || history.count!==94 || history.migrations.length!==94) throw new Error('HISTORICAL_MIGRATION_MANIFEST_INVALID');
  const historical = files.filter((name)=>name.slice(0,14)<=history.head);
  if (JSON.stringify(historical)!==JSON.stringify(history.migrations.map((item)=>item.file))) throw new Error('HISTORICAL_MIGRATION_FILESET_DRIFT');
  for (const item of history.migrations) {
    const digest = createHash('sha256').update(await readFile(join(MIGRATIONS,item.file))).digest('hex');
    if (digest!==item.sha256) throw new Error(`HISTORICAL_MIGRATION_HASH_DRIFT:${item.file}`);
  }
  const repair = files.filter((name)=>name.slice(0,14)>history.head);
  if (JSON.stringify(repair)!==JSON.stringify(expectedRepairFiles)) throw new Error(`REPAIR_MIGRATION_SEQUENCE_DRIFT:${JSON.stringify(repair)}`);
  const ownerCoverage = await readFile(join(MIGRATIONS,OWNER_OPERATOR_COVERAGE),'utf8');
  const stagingAssertions = ownerCoverage.match(new RegExp(OWNER_OPERATOR_COVERAGE_OPTIONAL_STAGING_ASSERTION.source,'g')) ?? [];
  if (stagingAssertions.length!==1) throw new Error('OWNER_OPERATOR_COVERAGE_OPTIONAL_STAGING_ASSERTION_DRIFT');
  await readFile(OBJECTS,'utf8').catch(()=>{ throw new Error('DATABASE_OBJECT_CONTRACT_MISSING'); });
}

function duplicateVersions(files) {
  const versions = new Map();
  for (const file of files) {
    const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file);
    if (!match) throw new Error(`INVALID_MIGRATION_FILENAME:${file}`);
    const existing = versions.get(match[1]) ?? [];
    existing.push(file); versions.set(match[1],existing);
  }
  return new Map([...versions].filter(([,names])=>names.length>1));
}

function omitExactEnvironmentAssertion(source,assertion,file) {
  const matches=source.match(new RegExp(assertion.source,'g'));
  if (matches?.length!==1) throw new Error(`MIGRATION_ENVIRONMENT_ASSERTION_DRIFT:${file}`);
  return source.replace(assertion,'\n');
}

async function execute(database,sql,label) {
  try { await database.exec(sql); }
  catch (error) { throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`,{cause:error}); }
}

async function seedBootstrapPrecondition(database) {
  await execute(database, `insert into public.users(id,tenant_id,enterprise_id,department_id,employee_no,display_name,email,status)
    values('user-fresh-replay-ethan','tenant-smart-wing','enterprise-demo','department-digital','SW_FRESH_REPLAY_ETHAN','Fresh Replay Ethan','fresh-replay@example.invalid','active');
    insert into public.members(id,user_id,primary_identifier,status) values('member-fresh-replay-ethan','user-fresh-replay-ethan','local_username:ethan','active');
    insert into public.member_login_aliases(provider,subject,member_id) values('local_username','ethan','member-fresh-replay-ethan');`,'bootstrap precondition');
}

async function seedPlatformOwnerTransferPrecondition(database) {
  await execute(database, `begin;
    do $owner_transfer_precondition$
    declare
      owner_count integer;
      owner_membership text;
      owner_principal text;
      owner_access_version bigint;
      owner_credential_version bigint;
    begin
      select count(distinct membership.id),min(membership.id)
      into owner_count,owner_membership
      from access.membership membership
      join member.profile profile on profile.id=membership.member_id and profile.status='active'
      join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
      join access.membershiprole assignment on assignment.membership_id=membership.id
        and assignment.role_id='role-platform-owner-v2'
        and assignment.effective_at<=clock_timestamp() and assignment.expires_at is null
      where membership.organization_id='tenant-zhudatuan' and membership.client='operator'
        and membership.status='active';
      if owner_count>1 then raise exception 'PLATFORM_OWNER_PRECONDITION_NOT_UNIQUE'; end if;

      if owner_count=0 then
        owner_membership:='membership:owner-transfer-preseed';
        owner_principal:='principal:owner-transfer-preseed';
        owner_access_version:=11;
        insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
        values(owner_principal,'active',1,clock_timestamp(),clock_timestamp(),0);
        owner_credential_version:=1;
        insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at)
        values('credential:owner-transfer-preseed',owner_principal,'password',repeat('0',64),
          'contract-owner-transfer-secret','active',clock_timestamp());
        insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
        values('member:owner-transfer-preseed',owner_principal,'Dirty pre-211 Owner','active',
          clock_timestamp(),clock_timestamp(),0);
        insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
        values(owner_membership,'member:owner-transfer-preseed','tenant-zhudatuan','operator','active',
          owner_access_version,clock_timestamp());
        insert into access.membershiprole(membership_id,role_id,effective_at)
        values(owner_membership,'role-platform-owner-v2','1970-01-01T00:00:00Z');
      else
        select profile.principal_id,membership.access_version,principal.credential_version
        into owner_principal,owner_access_version,owner_credential_version
        from access.membership membership
        join member.profile profile on profile.id=membership.member_id
        join identity.principal principal on principal.id=profile.principal_id
        where membership.id=owner_membership;
      end if;

      insert into access.role(id,scope_id,name,status,version)
      values('role:owner-transfer-preseed-deny-admin','tenant-zhudatuan',
        'Dirty pre-211 deny admin','active',1)
      on conflict(id) do update set scope_id=excluded.scope_id,name=excluded.name,status='active',version=1;
      insert into access.rolepermission(role_id,permission_id,effect)
      select 'role:owner-transfer-preseed-deny-admin',permission.id,'allow'
      from access.permission permission where permission.code='access.center.read'
      on conflict do nothing;
      insert into access.rolepermission(role_id,permission_id,effect)
      select 'role:owner-transfer-preseed-deny-admin',permission.id,'deny'
      from access.permission permission where permission.code='identity.invitation.manage'
      on conflict do nothing;

      update access.membershiprole set expires_at=clock_timestamp()
      where membership_id=owner_membership and role_id<>'role-platform-owner-v2'
        and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp());
      insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by)
      values(owner_membership,'role:owner-transfer-preseed-deny-admin',clock_timestamp(),'contract-precondition');
      insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by) values
        (owner_membership,'role-platform-owner-v2',clock_timestamp()+interval '1 day','contract-precondition'),
        (owner_membership,'role:self',clock_timestamp()+interval '1 day','contract-precondition');

      update access.scopegrant set expires_at=clock_timestamp()
      where membership_id=owner_membership and effective_at<=clock_timestamp()
        and (expires_at is null or expires_at>clock_timestamp());
      insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
      values
        ('scope:owner-transfer-preseed:platform',owner_membership,'platform','organization-platform-root',
          'organization-platform-root','allow',clock_timestamp(),owner_access_version),
        ('scope:owner-transfer-preseed:tenant',owner_membership,'tenant','tenant-zhudatuan',
          'tenant-zhudatuan','allow',clock_timestamp(),owner_access_version),
        ('scope:owner-transfer-preseed:platform-duplicate',owner_membership,'platform','organization-platform-root',
          'organization-platform-root','allow',clock_timestamp()+interval '1 microsecond',owner_access_version),
        ('scope:owner-transfer-preseed:department',owner_membership,'department','department:owner-transfer-dirty',
          'department:owner-transfer-dirty','allow',clock_timestamp(),owner_access_version),
        ('scope:owner-transfer-preseed:tenant-deny',owner_membership,'tenant','tenant-zhudatuan',
          'tenant-zhudatuan','deny',clock_timestamp()+interval '2 microseconds',owner_access_version),
        ('scope:owner-transfer-preseed:abnormal-self',owner_membership,'self',
          'self:principal:owner-transfer-preseed-wrong','self:principal:owner-transfer-preseed-wrong',
          'deny',clock_timestamp(),owner_access_version);

      insert into access.membershipoverride(membership_id,permission_id,effect,granted_by,reason,effective_at,
        expires_at,revoked_at)
      select owner_membership,permission.id,'deny','contract-precondition','dirty pre-211 Owner override',
        clock_timestamp(),null,null
      from access.permission permission where permission.code='access.center.read'
      on conflict(membership_id,permission_id) do update set effect='deny',granted_by='contract-precondition',
        reason='dirty pre-211 Owner override',effective_at=clock_timestamp(),expires_at=null,revoked_at=null;

      insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,attempts,expires_at,created_at)
      values('challenge:owner-transfer-precutover-stepup',owner_principal,'stepup',repeat('1',64),
        repeat('2',64),0,clock_timestamp()+interval '10 minutes',clock_timestamp());
      insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
      values('assurance:owner-transfer-precutover-stepup',owner_principal,'otp',3,repeat('3',64),
        clock_timestamp(),clock_timestamp()+interval '15 minutes');
      insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,
        ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
      values('session:owner-transfer-precutover-stepup',owner_principal,owner_membership,repeat('4',64),
        owner_credential_version,owner_access_version,'operator',repeat('5',64),'contract','precutover-stepup',3,
        clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp());
    end
    $owner_transfer_precondition$;
    set constraints all immediate;
    commit;`, 'platform Owner transfer pre-211 dirty-state seed');

  const evidence=await database.query(`with owner as (
      select membership.id membership_id,profile.principal_id
      from access.membership membership
      join member.profile profile on profile.id=membership.member_id and profile.status='active'
      join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
      join access.membershiprole assignment on assignment.membership_id=membership.id
        and assignment.role_id='role-platform-owner-v2' and assignment.effective_at<=clock_timestamp()
        and assignment.expires_at is null
      where membership.organization_id='tenant-zhudatuan' and membership.client='operator'
        and membership.status='active'
    ) select
      (select count(*)::integer from owner) owner_count,
      (select count(*)::integer from access.membershiprole assignment cross join owner
        where assignment.membership_id=owner.membership_id
          and assignment.role_id='role:owner-transfer-preseed-deny-admin'
          and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) dirty_role_count,
      (select count(*)::integer from access.rolepermission mapping
        where mapping.role_id='role:owner-transfer-preseed-deny-admin' and mapping.effect='deny') dirty_role_denies,
      (select count(*)::integer from access.membershipoverride overridepermission cross join owner
        where overridepermission.membership_id=owner.membership_id and overridepermission.effect='deny'
          and overridepermission.revoked_at is null and overridepermission.effective_at<=clock_timestamp()
          and (overridepermission.expires_at is null or overridepermission.expires_at>clock_timestamp())) dirty_overrides,
      (select count(*)::integer from access.membershiprole assignment cross join owner
        where assignment.membership_id=owner.membership_id and assignment.role_id='role:self'
          and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) active_self_roles,
      (select count(*)::integer from access.scopegrant grantrow cross join owner
        where grantrow.membership_id=owner.membership_id and grantrow.scope_kind='self'
          and grantrow.scope_id='self:'||owner.principal_id and grantrow.effect='allow'
          and grantrow.effective_at<=clock_timestamp()
          and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp())) correct_self_scopes,
      (select count(*)::integer from access.scopegrant grantrow cross join owner
        where grantrow.membership_id=owner.membership_id and grantrow.scope_kind='self'
          and grantrow.effect='deny' and grantrow.effective_at<=clock_timestamp()
          and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp())) abnormal_self_scopes,
      (select count(*)::integer from access.scopegrant grantrow cross join owner
        where grantrow.membership_id=owner.membership_id
          and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp())) dirty_scope_count,
      exists(select 1 from identity.challenge where id='challenge:owner-transfer-precutover-stepup'
        and consumed_at is null) stale_stepup_challenge,
      exists(select 1 from identity.assurance where id='assurance:owner-transfer-precutover-stepup'
        and expires_at>clock_timestamp()) stale_stepup_assurance,
      exists(select 1 from identity.session where id='session:owner-transfer-precutover-stepup'
        and revoked_at is null) stale_stepup_session`);
  const row=evidence.rows[0];
  if (!row || row.owner_count!==1 || row.dirty_role_count!==1 || row.dirty_role_denies<1
    || row.dirty_overrides!==1 || row.active_self_roles!==0 || row.correct_self_scopes!==0
    || row.abnormal_self_scopes!==1 || row.dirty_scope_count<6
    || !row.stale_stepup_challenge || !row.stale_stepup_assurance || !row.stale_stepup_session) {
    throw new Error(`PLATFORM_OWNER_TRANSFER_PRECONDITION_INVALID:${JSON.stringify(row??null)}`);
  }
}

async function installRegistrationReplayBoundary(database) {
  const sentinel='registration-fresh-replay-sentinel-not-for-production';
  await execute(database, `create extension if not exists pgcrypto;
    create schema if not exists deployment;
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
  `,'registration replay boundary');
}

async function verifyRegistrationBoundaryOnPostgres(database) {
  const retiredRoles = [
    'shopapp','shopmigration','shopread','zhudatuanbootstrap','zhudatuanwebapi',
    'zhudatuanpurchaseapi','zhudatuansandboxbootstrap',
  ];
  const runtimeRoles = ['shopjob','zhudatuanidentityapi','zhudatuanidentityjob'];
  const boundaryRoles = ['anon','authenticated','service_role','zhudatuanregistrationboundary'];
  const fixtureRoles = [
    'registration_rds_superuser_fixture','pg_rds_superuser','rds_boundary_admin','registration_boundary_outsider',
    ...retiredRoles,...runtimeRoles,...boundaryRoles,
  ];
  const preflight = (await database.query(`select current_database() database_name,
    current_setting('allow_system_table_mods') system_table_mods,
    coalesce((select rolsuper from pg_roles where rolname=current_user),false) authority_super,
    to_regnamespace('deployment') is not null deployment_exists`)).rows[0];
  const existingRoles = (await database.query(
    'select rolname from pg_roles where rolname=any($1::text[]) order by rolname',[fixtureRoles],
  )).rows.map((row)=>row.rolname);
  if (JSON.stringify(preflight)!==JSON.stringify({
    database_name:'zhudatuan_registration',system_table_mods:'on',authority_super:true,deployment_exists:false,
  }) || existingRoles.length!==0) {
    throw new Error(`REGISTRATION_BOUNDARY_POSTGRES_FIXTURE_UNSAFE:${JSON.stringify({preflight,existingRoles})}`);
  }

  await execute(database, `
    create extension pgcrypto;
    create role registration_rds_superuser_fixture nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    update pg_authid set rolname='pg_rds_superuser' where rolname='registration_rds_superuser_fixture';
    create role rds_boundary_admin nologin nosuperuser nocreatedb createrole noinherit noreplication nobypassrls;
    create role registration_boundary_outsider nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role shopapp nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuanbootstrap nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role shopmigration nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role shopread nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuanwebapi nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuanpurchaseapi nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuansandboxbootstrap nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role shopjob login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuanidentityapi login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuanidentityjob login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role anon nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role authenticated nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role service_role nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    create role zhudatuanregistrationboundary nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    grant pg_rds_superuser to rds_boundary_admin;
    grant usage on schema public to rds_boundary_admin;
    grant execute on function public.digest(text,text) to rds_boundary_admin;
    revoke all on schema public from public,anon,authenticated,service_role;
    revoke execute on all functions in schema public from public,anon,authenticated,service_role;
    alter database zhudatuan_registration owner to shopmigration;
    create schema deployment authorization rds_boundary_admin;
    create schema access authorization rds_boundary_admin;
    create schema runtime authorization rds_boundary_admin;
    revoke all on schema deployment from public;
    revoke all on schema access from public;
    revoke all on schema runtime from public;
    set session authorization rds_boundary_admin;
    create table deployment.boundary(
      id text primary key,database_name text not null,sentinel_hash char(64) not null check(sentinel_hash~'^[0-9a-f]{64}$'),
      created_at timestamptz not null default clock_timestamp()
    );
    insert into deployment.boundary(id,database_name,sentinel_hash)
    values('zhudatuan-registration-v1',current_database(),encode(public.digest('rds-like-replay-sentinel','sha256'),'hex'));
    create function deployment.registration_bootstrap_boundary(p_sentinel text)
    returns boolean language sql stable security definer set search_path=pg_catalog,deployment,public as $function$
      select current_database()='zhudatuan_registration'
        and session_user='zhudatuanbootstrap'
        and exists(select 1 from deployment.boundary
          where id='zhudatuan-registration-v1' and database_name=current_database()
            and sentinel_hash=encode(public.digest(p_sentinel,'sha256'),'hex'))
    $function$;
    create function deployment.is_independent_registration_database()
    returns boolean language sql stable security definer set search_path=pg_catalog,deployment as $function$
      select current_database()='zhudatuan_registration'
        and exists(select 1 from deployment.boundary
          where id='zhudatuan-registration-v1' and database_name=current_database())
    $function$;
    create table access.role(id text primary key,scope_id text not null,status text not null);
    create table access.membership(id text primary key,client text not null,status text not null);
    create table access.membershiprole(
      membership_id text not null,role_id text not null,effective_at timestamptz not null,expires_at timestamptz
    );
    create table runtime.schemaversion(version text primary key,checksum char(64) not null);
    alter table access.role enable row level security;
    alter table access.membership enable row level security;
    alter table access.membershiprole enable row level security;
    alter table runtime.schemaversion enable row level security;
    insert into access.role(id,scope_id,status)
    values('role-platform-owner-v2','tenant-zhudatuan','active');
    insert into access.membership(id,client,status)
    values('membership-platform-owner-fixture','operator','active');
    insert into access.membershiprole(membership_id,role_id,effective_at,expires_at)
    values('membership-platform-owner-fixture','role-platform-owner-v2',clock_timestamp()-interval '1 hour',null);
    insert into runtime.schemaversion(version,checksum)
    values('20260829060000','b1e238eb8de569b0de9d1d2766620e1f661268d2f9260e646208d4f24715b37a');
    revoke all on deployment.boundary from public;
    revoke all on function deployment.registration_bootstrap_boundary(text) from public;
    revoke all on function deployment.is_independent_registration_database() from public;
    grant usage on schema deployment to zhudatuanbootstrap,shopmigration;
    grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap;
    grant execute on function deployment.is_independent_registration_database() to shopmigration;
    reset session authorization;
  `,'registration boundary PostgreSQL fixture');

  const reconciliation = await readFile(REGISTRATION_BOUNDARY_RECONCILE,'utf8');
  const before = (await database.query(`select
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.registration_bootstrap_boundary(text)'::regprocedure) bootstrap_owner,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed,
    (select count(*)::integer from pg_auth_members membership join pg_roles owner
      on owner.oid in(membership.roleid,membership.member)
      where owner.rolname='zhudatuanregistrationboundary') owner_memberships`)).rows[0];
  await database.exec('set session authorization registration_boundary_outsider');
  try {
    await database.exec(reconciliation);
    throw new Error('REGISTRATION_BOUNDARY_UNPRIVILEGED_RECONCILE_UNEXPECTEDLY_SUCCEEDED');
  } catch (error) {
    if (!String(error instanceof Error?error.message:error).includes('ZHUDATUAN_REGISTRATION_BOUNDARY_RECONCILE_AUTHORITY_INVALID')) throw error;
  } finally {
    await database.exec('rollback');
    await database.exec('reset session authorization');
  }
  const afterDenied = (await database.query(`select
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.registration_bootstrap_boundary(text)'::regprocedure) bootstrap_owner,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed,
    (select count(*)::integer from pg_auth_members membership join pg_roles owner
      on owner.oid in(membership.roleid,membership.member)
      where owner.rolname='zhudatuanregistrationboundary') owner_memberships`)).rows[0];
  if (JSON.stringify(afterDenied)!==JSON.stringify(before)) {
    throw new Error(`REGISTRATION_BOUNDARY_UNPRIVILEGED_RECONCILE_LEAKED:${JSON.stringify({before,afterDenied})}`);
  }

  for (const label of [
    'RDS-like registration boundary reconciliation',
    'RDS-like registration boundary idempotent reconciliation',
  ]) {
    // Aliyun's pg_rds_superuser account can SET ROLE to an ordinary account
    // without a catalog membership.  Vanilla PG16 has no such predefined-role
    // behavior, so inject one disposable SET/ADMIN edge with the RDS authority
    // as grantor.  The reviewed reconciliation must remove it before commit.
    await execute(database, `
      grant zhudatuanregistrationboundary to rds_boundary_admin with admin true,inherit false,set true;
      update pg_auth_members set grantor=(select oid from pg_roles where rolname='rds_boundary_admin')
        where roleid=(select oid from pg_roles where rolname='zhudatuanregistrationboundary')
          and member=(select oid from pg_roles where rolname='rds_boundary_admin');
    `,`${label} fixture RDS SET capability`);
    await database.exec('set session authorization rds_boundary_admin');
    try {
      await execute(database,reconciliation,label);
    } finally {
      await database.exec('rollback');
      await database.exec('reset session authorization');
    }
    const boundaryMemberships = (await database.query(`select count(*)::integer memberships
      from pg_auth_members membership join pg_roles role
        on role.oid in(membership.roleid,membership.member)
      where role.rolname='zhudatuanregistrationboundary'`)).rows[0].memberships;
    if (boundaryMemberships!==0) {
      throw new Error(`REGISTRATION_BOUNDARY_POSTGRES_MEMBERSHIP_LEAK:${JSON.stringify({label,boundaryMemberships})}`);
    }
    if (label==='RDS-like registration boundary reconciliation') {
      const canonicalBoundaryState = (await database.query(`select
        (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
          where function.oid='deployment.registration_bootstrap_boundary(text)'::regprocedure) bootstrap_owner,
        position('pg_catalog.sha256' in pg_get_functiondef('deployment.registration_bootstrap_boundary(text)'::regprocedure))>0 catalog_body,
        position('public.digest' in pg_get_functiondef('deployment.registration_bootstrap_boundary(text)'::regprocedure))=0 public_digest_absent,
        exists(select 1 from pg_proc function
          cross join lateral unnest(function.proconfig) setting
          where function.oid='deployment.registration_bootstrap_boundary(text)'::regprocedure
            and regexp_replace(setting,'\\s','','g')='search_path=pg_catalog,deployment') canonical_search_path`)).rows[0];
      if (JSON.stringify(canonicalBoundaryState)!==JSON.stringify({
        bootstrap_owner:'zhudatuanregistrationboundary',catalog_body:true,
        public_digest_absent:true,canonical_search_path:true,
      })) throw new Error(`REGISTRATION_BOUNDARY_FIRST_PASS_CANONICAL_INVALID:${JSON.stringify(canonicalBoundaryState)}`);
      // Reproduce the exact upgrade state that exposed the staging failure:
      // the inert role already owns the legacy definer, while revoked PUBLIC
      // ACLs make public.digest unusable to that owner.  The idempotent pass
      // must still rewrite the body without granting any public privilege.
      await execute(database, `
        create or replace function deployment.registration_bootstrap_boundary(p_sentinel text)
        returns boolean language sql stable security definer set search_path=pg_catalog,deployment,public as $function$
          select current_database()='zhudatuan_registration'
            and session_user='zhudatuanbootstrap'
            and exists(select 1 from deployment.boundary
              where id='zhudatuan-registration-v1' and database_name=current_database()
                and sentinel_hash=encode(public.digest(p_sentinel,'sha256'),'hex'))
        $function$;
      `,'RDS-like legacy boundary-owned bootstrap fixture');
      const legacyBoundaryState = (await database.query(`select
        (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
          where function.oid='deployment.registration_bootstrap_boundary(text)'::regprocedure) bootstrap_owner,
        has_schema_privilege('zhudatuanregistrationboundary','public','USAGE') boundary_public_usage,
        has_function_privilege('zhudatuanregistrationboundary','public.digest(text,text)','EXECUTE') boundary_digest_execute,
        position('public.digest' in pg_get_functiondef('deployment.registration_bootstrap_boundary(text)'::regprocedure))>0 legacy_body`)).rows[0];
      if (JSON.stringify(legacyBoundaryState)!==JSON.stringify({
        bootstrap_owner:'zhudatuanregistrationboundary',boundary_public_usage:false,
        boundary_digest_execute:false,legacy_body:true,
      })) throw new Error(`REGISTRATION_BOUNDARY_LEGACY_UPGRADE_FIXTURE_INVALID:${JSON.stringify(legacyBoundaryState)}`);
    }
  }
  const finalState = (await database.query(`select
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.registration_bootstrap_boundary(text)'::regprocedure) bootstrap_owner,
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.is_independent_registration_database()'::regprocedure) migration_owner,
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.runtime_database_boundary()'::regprocedure) runtime_owner,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed,
    (select count(*)::integer from (values('shopjob'),('zhudatuanidentityapi'),('zhudatuanidentityjob')) expected(role_name)
      where has_function_privilege(expected.role_name,'deployment.runtime_database_boundary()','EXECUTE')) runtime_execute_count,
    (select count(*)::integer from (values('registration_boundary_outsider'),('shopapp'),('shopmigration'),
        ('shopread'),('zhudatuanbootstrap'),('zhudatuanwebapi'),('zhudatuanpurchaseapi'),
        ('zhudatuansandboxbootstrap')) denied(role_name)
      where has_function_privilege(denied.role_name,'deployment.runtime_database_boundary()','EXECUTE')) denied_execute_count,
    (select count(*)::integer from pg_auth_members membership join pg_roles owner
      on owner.oid in(membership.roleid,membership.member)
      where owner.rolname='zhudatuanregistrationboundary') owner_memberships,
    has_schema_privilege('zhudatuanregistrationboundary','public','USAGE') boundary_public_usage,
    (select count(*)::integer from pg_proc function
      join pg_namespace namespace on namespace.oid=function.pronamespace and namespace.nspname='public'
      where has_function_privilege('zhudatuanregistrationboundary',function.oid,'EXECUTE')) boundary_public_execute_count,
    (select not rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole and not rolinherit
      and not rolreplication and not rolbypassrls from pg_roles
      where rolname='zhudatuanregistrationboundary') owner_restricted`)).rows[0];
  if (JSON.stringify(finalState)!==JSON.stringify({
    bootstrap_owner:'zhudatuanregistrationboundary',migration_owner:'zhudatuanregistrationboundary',
    runtime_owner:'zhudatuanregistrationboundary',definer_allowed:true,runtime_execute_count:3,
    denied_execute_count:0,owner_memberships:0,boundary_public_usage:false,boundary_public_execute_count:0,
    owner_restricted:true,
  })) throw new Error(`REGISTRATION_BOUNDARY_POSTGRES_FINAL_STATE_INVALID:${JSON.stringify(finalState)}`);

  await database.exec('set session authorization registration_boundary_outsider');
  try {
    for (const [label,sql] of [
      ['bootstrap','select deployment.registration_bootstrap_boundary(\'rds-like-replay-sentinel\')'],
      ['public-digest','select public.digest(\'rds-like-replay-sentinel\',\'sha256\')'],
    ]) {
      let denied = false;
      try {
        await database.query(sql);
      } catch (error) {
        if (!String(error instanceof Error?error.message:error).includes('permission denied')) throw error;
        denied = true;
      }
      if (!denied) throw new Error(`REGISTRATION_BOUNDARY_OUTSIDER_UNEXPECTEDLY_ALLOWED:${label}`);
    }
  } finally {
    await database.exec('reset session authorization');
  }

  const healthyBoundary = {
    active_platform_owner_count:1,migration_head_valid:true,retired_roles_valid:true,runtime_roles_valid:true,
    boundary_roles_valid:true,retired_membership_count:0,
    registration_boundary_owner:'zhudatuanregistrationboundary',
    migration_boundary_owner:'zhudatuanregistrationboundary',
    runtime_boundary_owner:'zhudatuanregistrationboundary',database_owner:'shopmigration',
  };
  for (const role of runtimeRoles) {
    await database.exec(`set session authorization "${role}"`);
    try {
      const boundary = (await database.query('select * from deployment.runtime_database_boundary()')).rows[0];
      if (JSON.stringify(boundary)!==JSON.stringify(healthyBoundary)) {
        throw new Error(`REGISTRATION_RUNTIME_DATABASE_BOUNDARY_INVALID:${JSON.stringify({role,boundary})}`);
      }
    } finally {
      await database.exec('reset session authorization');
    }
  }
  for (const role of ['registration_boundary_outsider',...retiredRoles]) {
    await database.exec(`set session authorization "${role}"`);
    let denied = false;
    try {
      await database.query('select * from deployment.runtime_database_boundary()');
    } catch (error) {
      if (!String(error instanceof Error?error.message:error).includes('permission denied')) throw error;
      denied = true;
    } finally {
      await database.exec('reset session authorization');
    }
    if (!denied) throw new Error(`REGISTRATION_RUNTIME_DATABASE_BOUNDARY_UNEXPECTEDLY_ALLOWED:${role}`);
  }

  await database.exec('set session authorization zhudatuanbootstrap');
  const bootstrapCall = (await database.query(
    'select deployment.registration_bootstrap_boundary($1) sentinel_valid',['rds-like-replay-sentinel'],
  )).rows[0];
  await database.exec('reset session authorization');
  await database.exec('set session authorization shopmigration');
  const migrationCall = (await database.query(`select
    deployment.registration_bootstrap_boundary('rds-like-replay-sentinel') bootstrap_direct,
    deployment.is_independent_registration_database() migration_boundary`)).rows[0];
  await database.exec('reset session authorization');
  if (JSON.stringify({bootstrapCall,migrationCall})!==JSON.stringify({
    bootstrapCall:{sentinel_valid:true},migrationCall:{bootstrap_direct:false,migration_boundary:true},
  })) throw new Error(`REGISTRATION_BOUNDARY_POSTGRES_CALL_CHAIN_INVALID:${JSON.stringify({bootstrapCall,migrationCall})}`);
}

async function reconcileRegistrationReplayBoundary(database) {
  // Model an existing volume initialized before shopmigration was added to
  // the nested SECURITY DEFINER boundary. The replay must exercise the exact
  // privileged reconciliation artifact used in production.
  await execute(database, `
    alter role zhudatuanbootstrap noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    alter role shopmigration noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    grant usage on schema deployment to zhudatuanbootstrap,shopmigration;
    revoke execute on function deployment.registration_bootstrap_boundary(text) from shopmigration;
    grant execute on function deployment.registration_bootstrap_boundary(text) to zhudatuanbootstrap;
    grant execute on function deployment.is_independent_registration_database() to shopmigration;
  `,'registration replay legacy boundary state');
  const before = await database.query(`select
    has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE') bootstrap_allowed,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed`);
  if (JSON.stringify(before.rows[0])!==JSON.stringify({bootstrap_allowed:true,definer_allowed:false})) {
    throw new Error(`REGISTRATION_REPLAY_LEGACY_BOUNDARY_INVALID:${JSON.stringify(before.rows[0])}`);
  }
  const reconciliation = await readFile(REGISTRATION_BOUNDARY_RECONCILE,'utf8');
  await execute(database,reconciliation,'registration replay privileged boundary reconciliation');
  await execute(database,reconciliation,'registration replay idempotent boundary reconciliation');
  const after = await database.query(`select
    has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE') bootstrap_allowed,
    has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed,
    has_function_privilege('shopmigration','deployment.is_independent_registration_database()','EXECUTE') migration_boundary_allowed,
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.registration_bootstrap_boundary(text)'::regprocedure) bootstrap_owner,
    (select owner.rolname from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='deployment.is_independent_registration_database()'::regprocedure) migration_owner,
    (select count(*)::integer from pg_auth_members membership join pg_roles owner
      on owner.oid in(membership.roleid,membership.member)
      where owner.rolname='zhudatuanregistrationboundary') owner_memberships`);
  if (JSON.stringify(after.rows[0])!==JSON.stringify({
    bootstrap_allowed:true,definer_allowed:true,migration_boundary_allowed:true,
    bootstrap_owner:'zhudatuanregistrationboundary',migration_owner:'zhudatuanregistrationboundary',owner_memberships:0,
  })) {
    throw new Error(`REGISTRATION_REPLAY_RECONCILED_BOUNDARY_INVALID:${JSON.stringify(after.rows[0])}`);
  }
}

async function stageFreshReplaySecrets(database) {
  await execute(database, `insert into runtime.vouchersecretstage(voucher_id,code_ciphertext,code_fingerprint,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(voucher_code,'sha256'),'base64'),encode(digest(lower(voucher_code),'sha256'),'hex'),'fixture-v1',created_at
    from public.vouchers on conflict(voucher_id) do nothing;
    insert into runtime.partneraddressstage(store_id,address_ciphertext,address_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(address_text,'sha256'),'base64'),encode(digest(lower(address_text),'sha256'),'hex'),'fixture-v1',created_at
    from public.stores where address_text is not null on conflict(store_id) do nothing;
    insert into runtime.distributorcontactstage(distributor_id,contact_ciphertext,contact_token,key_version,staged_at)
    select id,'fixturekms:v1:'||encode(digest(contact_json::text,'sha256'),'base64'),encode(digest(contact_json::text,'sha256'),'hex'),'fixture-v1',created_at
    from public.distributors where contact_json<>'{}'::jsonb on conflict(distributor_id) do nothing;`,'secure fixture stage');
}

async function seedUnsafeInventoryCutover(database) {
  await execute(database, `do $$ begin update public.inventory set reserved_qty=greatest(reserved_qty,1); if not found then raise exception 'UNSAFE_INVENTORY_FIXTURE_MISSING'; end if; end $$;`,'unsafe inventory fixture');
}

async function assertUnsafeInventoryCutoverRejected(database,sql) {
  try { await database.exec(sql); }
  catch (error) {
    if (!String(error instanceof Error?error.message:error).includes('INVENTORY_CUTOVER_RECONCILIATION_REQUIRED')) throw error;
    if ((await database.query("select to_regclass('inventory.cutover_reviews') is not null as leaked")).rows[0].leaked) throw new Error('UNSAFE_INVENTORY_CUTOVER_PARTIAL_COMMIT');
    return;
  }
  throw new Error('UNSAFE_INVENTORY_CUTOVER_UNEXPECTEDLY_SUCCEEDED');
}

async function verifyTarget(database) {
  const operationContract = parse(await readFile(join(ROOT,'packages','contract','definitions','operations.yml'),'utf8'));
  const eventContract = parse(await readFile(join(ROOT,'packages','contract','definitions','events.yml'),'utf8'));
  const expectedOperations = Array.isArray(operationContract?.operations) ? operationContract.operations.length : -1;
  const expectedEvents = Array.isArray(eventContract?.events) ? eventContract.events.length : -1;
  const result = await database.query(`select
    (select count(*)::integer from runtime.operation) operations,
    (select count(*)::integer from runtime.event) events,
    (select count(*)::integer from pg_tables where schemaname='public') public_tables,
    (select count(*)::integer from supabase_migrations.schema_migrations) migrations`);
  const row=result.rows[0];
  if (row.operations!==expectedOperations || row.events!==expectedEvents || row.public_tables!==0 || row.migrations!==migrationFiles.length) throw new Error(`TARGET_CATALOG_INVALID:${JSON.stringify(row)}`);
  await verifyObjectContract(database);
  await verifyRls(database);
  await verifyAuditImmutability(database);
  await verifyZhudatuanRegistrationBaseline(database);
  await execute(database,await readFile(OPERATOR_INVITATION_CONTRACT,'utf8'),'zhudatuan operator invitation registration contract');
  await verifyZhudatuanRuntimeReadinessRepair(database);
  await verifyZhudatuanBootstrapRuntimeRepair(database);
  await verifyZhudatuanWebBusinessAccess(database);
  await verifyZhudatuanPurchaseAccess(database);
  if (mode === '--postgres-fresh') {
    await installRegistrationReplayBoundary(database);
    await reconcileRegistrationReplayBoundary(database);
  }
  await verifyOwnerOperatorCoverage(database);
  await verifyPlatformOwnerTransfer(database);
  await verifySandboxCatalogBootstrap(database);
  await verifyExperiencePublication(database);
  await verifyExtensionLifecycle(database);
  // This must remain last: PGlite cannot reset SESSION AUTHORIZATION. The
  // registration replay uses the canonical database name and sentinel, so it
  // can exercise the real direct-login one-shot boundaries before close.
  if (mode === '--registration-fresh') await verifySandboxMemberBootstraps(database);
}

async function verifyZhudatuanRuntimeReadinessRepair(database) {
  const contract = await database.query(`select checksum from runtime.schemaversion
    where version='20260821032000'`);
  if (contract.rows[0]?.checksum!=='83892ce3a42c15ab21703902380b63b6cc3352000d0c4c2a9df50b60347e383a') {
    throw new Error(`ZHUDATUAN_RUNTIME_CONTRACT_CHECKSUM_INVALID:${JSON.stringify(contract.rows)}`);
  }
  const expectations = [
    ['zhudatuanidentityapi',['20260821032000','20260821054000','20260828170000']],
    ['zhudatuanidentityjob',['20260821032000','20260821054000','20260828170000']],
    ['zhudatuanbootstrap',['20260828170000']],
  ];
  for (const [role,versions] of expectations) {
    await database.exec(`begin; set local role ${role};`);
    try {
      const visible = await database.query('select array_agg(version order by version) versions from runtime.schemaversion');
      if (JSON.stringify(visible.rows[0]?.versions)!==JSON.stringify(versions)) {
        throw new Error(`ZHUDATUAN_SCHEMA_VERSION_RLS_INVALID:${role}:${JSON.stringify(visible.rows[0])}`);
      }
    } finally {
      await database.exec('rollback');
    }
  }
}

async function verifyOwnerOperatorCoverage(database) {
  const coverage = await database.query(`with expected(code) as (
      select distinct permission.code
      from capability.operation operation
      join capability.capability capability
        on capability.id=operation.capability_id and capability.status='active'
      join access.permission permission
        on permission.code=operation.permission_code and permission.status='active'
      where operation.audience='operator'
    ), actual(code) as (
      select permission.code
      from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id='role-platform-owner-v2' and mapping.effect='allow'
    ), missing(code) as (
      select code from expected except select code from actual
    ), extra(code) as (
      select code from actual except select code from expected
    ), operator_capability(capability_id) as (
      select distinct operation.capability_id
      from capability.operation operation
      join capability.capability capability
        on capability.id=operation.capability_id and capability.status='active'
      where operation.audience='operator'
    ), permanent_entitlement(capability_id) as (
      select entitlement.capability_id
      from capability.entitlement entitlement
      where entitlement.scope_id='organization-platform-root'
        and entitlement.state='enabled'
        and entitlement.effective_at='1970-01-01T00:00:00Z'
        and entitlement.expires_at is null
    ) select
      (select count(*)::integer from expected) operator_permissions,
      (select count(*)::integer from actual) owner_allows,
      (select count(*)::integer from missing) missing_permissions,
      (select count(*)::integer from extra) extra_permissions,
      (select count(*)::integer from access.rolepermission
        where role_id='role-platform-owner-v2' and effect='deny') owner_denies,
      (select count(*)::integer
        from capability.operation operation
        join capability.capability capability
          on capability.id=operation.capability_id and capability.status='active'
        join access.permission permission
          on permission.code=operation.permission_code and permission.status='active'
        where operation.audience='operator'
          and permission.code='identity.invitation.manage') invitation_operator_operations,
      (select count(*)::integer
        from access.rolepermission mapping
        join access.permission permission on permission.id=mapping.permission_id
        where mapping.role_id='role-platform-owner-v2' and mapping.effect='allow'
          and permission.status='active'
          and permission.code='identity.invitation.manage') invitation_owner_allows,
      (select count(*)::integer from capability.operation operation
        left join capability.capability capability on capability.id=operation.capability_id
        left join access.permission permission on permission.code=operation.permission_code
        where operation.audience='operator' and (
          capability.id is null or capability.status<>'active'
          or operation.permission_code is null
          or permission.id is null or permission.status<>'active')) invalid_operator_catalog,
      (select count(*)::integer from (
        select capability_id from operator_capability
        except select capability_id from permanent_entitlement
      ) drift) missing_entitlements,
      (select count(*)::integer from pg_trigger trigger
        join pg_class relation on relation.oid=trigger.tgrelid
        join pg_namespace namespace on namespace.oid=relation.relnamespace
        where not trigger.tgisinternal and trigger.tgdeferrable and trigger.tginitdeferred
          and trigger.tgname like 'platform_owner_operator_coverage_%'
          and namespace.nspname||'.'||relation.relname in(
            'access.permission','access.role','access.rolepermission',
            'capability.capability','capability.entitlement','capability.operation')) deferred_guards,
      exists(select 1 from runtime.schemaversion where version='20260829210000'
        and checksum='7a5e2d2cb2e3682674a3d8a7ac52177ba0f6ee93588bd9a7f489d4c405a4d222') schema_current,
      has_function_privilege('shopapp','access.enforce_platform_owner_operator_coverage()','EXECUTE') app_execute,
      has_function_privilege('shopjob','access.enforce_platform_owner_operator_coverage()','EXECUTE') job_execute`);
  const row = coverage.rows[0];
  if (!row || row.operator_permissions<1 || row.owner_allows!==row.operator_permissions
    || row.missing_permissions!==0 || row.extra_permissions!==0 || row.owner_denies!==0
    || row.invitation_operator_operations<1 || row.invitation_owner_allows!==1
    || row.invalid_operator_catalog!==0 || row.missing_entitlements!==0
    || row.deferred_guards!==6 || row.schema_current!==true
    || row.app_execute!==false || row.job_execute!==false) {
    throw new Error(`OWNER_OPERATOR_COVERAGE_INVALID:${JSON.stringify(row??null)}`);
  }

  const ownerCoverageSource = await readFile(join(MIGRATIONS,OWNER_OPERATOR_COVERAGE),'utf8');
  const boundaryGuards = ownerCoverageSource.match(new RegExp(OWNER_OPERATOR_COVERAGE_BOUNDARY_GUARD.source,'g')) ?? [];
  if (boundaryGuards.length!==1) throw new Error('OWNER_OPERATOR_COVERAGE_BOUNDARY_GUARD_DRIFT');
  const boundaryGuard = boundaryGuards[0];
  await exerciseOwnerCoverageBoundary(database,boundaryGuard,`
    delete from runtime.schemaversion
    where version='20260829060000' or version>'20260829210000';`,null);
  await exerciseOwnerCoverageBoundary(database,boundaryGuard,`
    delete from runtime.schemaversion where version>'20260829210000';
    insert into runtime.schemaversion(version,checksum)
    values('20260829060000','b1e238eb8de569b0de9d1d2766620e1f661268d2f9260e646208d4f24715b37a')
    on conflict(version) do update set checksum=excluded.checksum;`,null);
  await exerciseOwnerCoverageBoundary(database,boundaryGuard,`
    delete from runtime.schemaversion where version>'20260829210000';
    insert into runtime.schemaversion(version,checksum)
    values('20260829060000','${'0'.repeat(64)}')
    on conflict(version) do update set checksum=excluded.checksum;`,
  'OWNER_OPERATOR_COVERAGE_OPTIONAL_PREDECESSOR_INVALID');
  await exerciseOwnerCoverageBoundary(database,boundaryGuard,`
    delete from runtime.schemaversion where version>'20260829210000';
    insert into runtime.schemaversion(version,checksum)
    values('20260829060001','${'0'.repeat(64)}')
    on conflict(version) do update set checksum=excluded.checksum;`,
  'OWNER_OPERATOR_COVERAGE_FUTURE_HEAD_INVALID');

  // Multiple catalog writes may be ordered freely inside one transaction. The
  // invariant is evaluated only when the final transaction state is checked.
  await database.exec(`begin;
    delete from access.rolepermission
    where role_id='role-platform-owner-v2' and effect='allow'
      and permission_id=(select permission.id
        from capability.operation operation
        join access.permission permission on permission.code=operation.permission_code
        where operation.audience='operator' order by permission.id limit 1);
    insert into access.rolepermission(role_id,permission_id,effect)
    select 'role-platform-owner-v2',permission.id,'allow'
    from capability.operation operation
    join access.permission permission on permission.code=operation.permission_code
    where operation.audience='operator' order by permission.id limit 1
    on conflict do nothing;
    set constraints all immediate;
    rollback;`);

  await expectOwnerCoverageFailure(database, `delete from access.rolepermission
    where role_id='role-platform-owner-v2' and effect='allow'
      and permission_id=(select permission.id
        from capability.operation operation
        join access.permission permission on permission.code=operation.permission_code
        where operation.audience='operator' order by permission.id limit 1)`,
  'PLATFORM_OWNER_OPERATOR_PERMISSION_DRIFT');
  await expectOwnerCoverageFailure(database, `delete from capability.entitlement
    where scope_id='organization-platform-root' and state='enabled'
      and effective_at='1970-01-01T00:00:00Z' and expires_at is null
      and capability_id=(select operation.capability_id from capability.operation operation
        where operation.audience='operator' order by operation.capability_id limit 1)`,
  'PLATFORM_OWNER_OPERATOR_ENTITLEMENT_DRIFT');
  await expectOwnerCoverageFailure(database, `update capability.operation set permission_code=null
    where operation_id=(select operation_id from capability.operation
      where audience='operator' order by operation_id limit 1)`,
  'OWNER_OPERATOR_CATALOG_INVALID');
  const activeOwner = await database.query(`select exists(select 1 from access.platformowner
    where singleton=true and state='active') present`);
  if (activeOwner.rows[0]?.present) {
    await expectOwnerCoverageFailure(database, `insert into access.rolepermission(role_id,permission_id,effect)
      select 'role:self',permission.id,'deny'
      from capability.operation operation
      join access.permission permission on permission.code=operation.permission_code
      where operation.audience='operator' order by permission.id limit 1`,
    'PLATFORM_OWNER_RESOLVED_COVERAGE_DRIFT');
  }
  const restored=await database.query(`select
    (not exists(select 1 from access.platformowner where singleton=true and state='active')
      or not exists(select binding.operation_id from capability.operation binding where binding.audience='operator'
        except select operation_id from access.platformowner owner
          cross join lateral capability.membership_operations(owner.membership_id)
        where owner.singleton=true and owner.state='active')) complete,
    not exists(select 1 from access.platformowner owner
      cross join lateral access.resolve_membership(owner.membership_id) resolved
      where owner.singleton=true and owner.state='active' and cardinality(resolved.denies)>0) no_denies`);
  if (JSON.stringify(restored.rows[0])!==JSON.stringify({complete:true,no_denies:true})) {
    throw new Error(`PLATFORM_OWNER_RESOLVED_COVERAGE_ROLLBACK_INVALID:${JSON.stringify(restored.rows[0])}`);
  }
}

async function verifyPlatformOwnerTransfer(database) {
  const catalog=await database.query(`select
    (select count(*)::integer from access.platformowner) singleton_rows,
    (select state from access.platformowner where singleton=true) owner_state,
    exists(select 1 from runtime.schemaversion where version='20260829211000'
      and checksum='8e5616553e7639467438029d37337593e5cc27be63a9460c69a7cda9916a0684') schema_current,
    (select count(*)::integer from runtime.operation where id like 'access.ownership.%') operations,
    exists(select 1 from capability.operation operation join capability.entitlement entitlement
      on entitlement.capability_id=operation.capability_id and entitlement.scope_id='organization-platform-root'
      and entitlement.state='enabled' and entitlement.expires_at is null
      where operation.operation_id='identity.mobile.challenge' and operation.permission_code='identity.mobile.manage'
        and operation.audience='member') mobile_challenge,
    has_function_privilege('shopapp','access.create_owner_transfer(text,text,text,text,bigint,bigint)','EXECUTE') create_execute,
    has_function_privilege('shopapp','access.commit_owner_transfer(text,text,text,text,bigint,bigint,bigint)','EXECUTE') accept_execute,
    has_function_privilege('shopapp','access.cancel_owner_transfer(text,text,text,text,bigint,bigint,bigint,text)','EXECUTE') cancel_execute,
    has_function_privilege('shopapp','access.change_zhudatuan_owner_mobile(text,text,text,text,text,text,text,text,text)','EXECUTE') mobile_execute,
    has_function_privilege('shopapp','identity.rotate_zhudatuan_owner_password(text,text,text,text,text)','EXECUTE') password_execute,
    to_regprocedure('deployment.activate_zhudatuan_platform_owner(text,text)') is null bootstrap_activation_absent,
    (select count(*)::integer from pg_trigger trigger where not trigger.tgisinternal
      and trigger.tgname in('protect_zhudatuan_owner_role','protect_zhudatuan_owner_rolepermission',
        'protect_zhudatuan_owner_membership','protect_zhudatuan_owner_membershiprole',
        'protect_zhudatuan_owner_scopegrant','protect_zhudatuan_owner_membershipoverride',
        'protect_zhudatuan_owner_principal','protect_zhudatuan_owner_credential',
        'protect_zhudatuan_owner_profile')
      and trigger.tgfoid='access.protect_zhudatuan_owner()'::regprocedure) owner_protection_triggers,
    has_function_privilege('zhudatuanbootstrap','deployment.zhudatuan_owner_bootstrap_state(text)','EXECUTE') bootstrap_state_execute,
    has_schema_privilege('zhudatuanbootstrap','deployment','USAGE') bootstrap_schema_usage,
    has_schema_privilege('shopapp','deployment','USAGE') app_bootstrap_schema_usage,
    has_function_privilege('shopapp','deployment.zhudatuan_owner_bootstrap_state(text)','EXECUTE') app_bootstrap_state_execute,
    has_function_privilege('shopmigration','deployment.zhudatuan_owner_bootstrap_state(text)','EXECUTE') migration_bootstrap_state_execute,
    has_table_privilege('zhudatuanbootstrap','access.platformowner','SELECT') bootstrap_owner_read,
    has_table_privilege('shopapp','access.platformowner','SELECT') owner_read,
    has_table_privilege('shopapp','access.platformowner','UPDATE') owner_write,
    has_table_privilege('shopapp','access.ownertransfer','SELECT') transfer_read,
    has_table_privilege('shopapp','access.ownertransfer','INSERT') transfer_insert,
    has_table_privilege('shopapp','access.ownertransfer','UPDATE') transfer_update,
    has_table_privilege('shopapp','access.ownertransfer','DELETE') transfer_delete,
    has_table_privilege('shopapp','access.owneractionproof','INSERT') proof_insert,
    has_table_privilege('shopapp','access.owneractionproof','SELECT') proof_read,
    has_table_privilege('shopapp','access.owneractionproof','UPDATE') proof_update,
    has_table_privilege('shopapp','access.owneractionproof','DELETE') proof_delete,
    has_table_privilege('shopjob','access.ownertransfer','SELECT') job_read`);
  const catalogRow=catalog.rows[0];
  if (!catalogRow || catalogRow.singleton_rows!==1 || !['active','bootstrap_pending'].includes(catalogRow.owner_state)
    || !catalogRow.schema_current
    || catalogRow.operations!==7 || !catalogRow.mobile_challenge
    || !catalogRow.create_execute || !catalogRow.accept_execute || !catalogRow.cancel_execute || !catalogRow.mobile_execute
    || !catalogRow.password_execute || !catalogRow.bootstrap_activation_absent
    || catalogRow.owner_protection_triggers!==9 || !catalogRow.bootstrap_state_execute
    || !catalogRow.bootstrap_schema_usage || catalogRow.app_bootstrap_schema_usage
    || catalogRow.app_bootstrap_state_execute || catalogRow.migration_bootstrap_state_execute
    || catalogRow.bootstrap_owner_read
    || !catalogRow.owner_read || catalogRow.owner_write || !catalogRow.transfer_read
    || catalogRow.transfer_insert || catalogRow.transfer_update || catalogRow.transfer_delete
    || !catalogRow.proof_insert || catalogRow.proof_read || catalogRow.proof_update || catalogRow.proof_delete
    || catalogRow.job_read) {
    throw new Error(`PLATFORM_OWNER_TRANSFER_CATALOG_INVALID:${JSON.stringify(catalogRow??null)}`);
  }
  for (const statement of [
    'update access.platformowner set version=version',
    'insert into access.ownertransfer select * from access.ownertransfer where false',
    'update access.ownertransfer set version=version',
    'delete from access.ownertransfer',
    'select * from access.owneractionproof limit 1',
    'update access.owneractionproof set consumed_at=consumed_at',
    'delete from access.owneractionproof',
    `insert into access.owneractionproof(nonce,action,actor_id,session_id,source_membership_id,
      target_membership_id,former_owner_mode,former_owner_role_id,former_owner_role_version,ownership_version,
      transfer_version,target_access_version,reason_hash,expires_at,created_at) values(
      'owner-proof:acl-spoof','create','principal:acl-spoof','session:acl-spoof','membership:acl-spoof',
      'membership:acl-target','remove_admin',null,null,0,null,1,null,clock_timestamp()+interval '5 minutes',clock_timestamp())`,
  ]) await expectOwnerAclRejection(database,statement);
  await expectOwnerBootstrapAclRejection(database,'select * from access.platformowner');
  if (mode==='--owner-transfer') await verifyPlatformOwnerMigrationNormalization(database);

  await database.exec(`begin isolation level serializable;
    insert into access.role(id,scope_id,name,status,version)
    values('role:owner-transfer-test-admin','tenant-zhudatuan','Owner transfer test admin','active',1)
    on conflict(id) do update set status='active',version=1;
    insert into access.rolepermission(role_id,permission_id,effect)
    select 'role:owner-transfer-test-admin',id,'allow' from access.permission
    where code in('access.center.read','identity.assurance.manage','identity.mobile.manage')
    on conflict do nothing;`);
  try {
    if (catalogRow.owner_state==='bootstrap_pending') {
      const bootstrapSecret=`scrypt$v1$32768$8$1$${'A'.repeat(22)}$${'B'.repeat(86)}`;
      const legacyTombstone=await database.query(`select membership.member_id,profile.principal_id,
        (select count(*)::integer from identity.credential credential
          where credential.principal_id=profile.principal_id and credential.provider='alias.localusername'
            and credential.status='revoked') revoked_aliases,
        (select count(*)::integer from access.membership sibling where sibling.member_id=membership.member_id
          and sibling.id<>membership.id and sibling.status='suspended') suspended_siblings
        from access.membership membership join member.profile profile on profile.id=membership.member_id
        join identity.principal principal on principal.id=profile.principal_id
        where membership.id='membership-platform-owner-ethan-v1' and membership.organization_id='mall-demo'
          and membership.client='operator' and membership.status='suspended'
          and profile.status='disabled' and principal.status='disabled'`);
      if (legacyTombstone.rows[0]) {
        await database.exec('savepoint malformed_legacy_tombstone;');
        await database.query(`update member.profile
          set mobile_ciphertext='stale-legacy-mobile',mobile_token=repeat('a',64) where id=$1`,
        [legacyTombstone.rows[0].member_id]);
        await database.exec('set local session authorization zhudatuanbootstrap;');
        const malformedState=await database.query(`select * from deployment.zhudatuan_owner_bootstrap_state($1)`,
          ['registration-fresh-replay-sentinel-not-for-production']);
        if (malformedState.rows[0]?.fixed_identity_collision!==true) {
          throw new Error(`PLATFORM_OWNER_MALFORMED_TOMBSTONE_STATE_ALLOWED:${JSON.stringify(malformedState.rows[0]??null)}`);
        }
        let malformedRejected=false;
        try {
          await database.query(`select deployment.bootstrap_zhudatuan_owner($1,$2,$3,$4,$5)`,[
            'registration-fresh-replay-sentinel-not-for-production','6'.repeat(64),bootstrapSecret,
            '7'.repeat(64),'bootstrap:owner-transfer-contract',
          ]);
        } catch (error) {
          malformedRejected=String(error instanceof Error?error.message:error).includes('OWNER_BOOTSTRAP_CONFLICT');
        }
        await database.exec('rollback to savepoint malformed_legacy_tombstone; reset session authorization;');
        if (!malformedRejected) throw new Error('PLATFORM_OWNER_MALFORMED_TOMBSTONE_NOT_REJECTED');
        const rollback=await database.query(`select mobile_ciphertext is null and mobile_token is null restored
          from member.profile where id=$1`,[legacyTombstone.rows[0].member_id]);
        if (rollback.rows[0]?.restored!==true) throw new Error('PLATFORM_OWNER_MALFORMED_TOMBSTONE_PARTIAL_WRITE');
      }
      await database.exec(`reset role; set local session authorization zhudatuanbootstrap;`);
      const pendingBootstrapState=await database.query(
        `select * from deployment.zhudatuan_owner_bootstrap_state($1)`,
        ['registration-fresh-replay-sentinel-not-for-production'],
      );
      if (JSON.stringify(pendingBootstrapState.rows[0])!==JSON.stringify({
        state:'bootstrap_pending',active_owner_count:0,principal_id:null,membership_id:null,
        current_owner_valid:false,fixed_identity_collision:false,
      })) throw new Error(`PLATFORM_OWNER_PENDING_BOOTSTRAP_STATE_INVALID:${JSON.stringify(
        pendingBootstrapState.rows[0]??null)}`);
      const activated=await database.query(`select deployment.bootstrap_zhudatuan_owner($1,$2,$3,$4,$5) state`,[
        'registration-fresh-replay-sentinel-not-for-production','6'.repeat(64),bootstrapSecret,
        '7'.repeat(64),'bootstrap:owner-transfer-contract',
      ]);
      await database.exec('reset session authorization');
      if (activated.rows[0]?.state!=='created') throw new Error('PLATFORM_OWNER_BOOTSTRAP_ACTIVATION_INVALID');
      const audit=await database.query(`select count(*)::integer count from runtime.outbox
        where event_type='access.owner.bootstrapped' and aggregate_id='membership-platform-owner-ethan-v1'`);
      if (audit.rows[0]?.count!==1) throw new Error('PLATFORM_OWNER_BOOTSTRAP_AUDIT_MISSING');
      if (legacyTombstone.rows[0]) {
        const rehydrated=await database.query(`select membership.id,membership.member_id,membership.organization_id,
          membership.client,membership.status,profile.principal_id,profile.status profile_status,
          principal.status principal_status,
          (select count(*)::integer from identity.credential credential
            where credential.principal_id=profile.principal_id and credential.provider='password'
              and credential.status='active' and credential.subject_hash=$1) active_passwords,
          (select count(*)::integer from identity.credential credential
            where credential.principal_id=profile.principal_id and credential.provider='alias.localusername'
              and credential.status='revoked') revoked_aliases,
          (select count(*)::integer from access.membership sibling where sibling.member_id=membership.member_id
            and sibling.id<>membership.id and sibling.status in('active','invited')) live_siblings,
          (select count(*)::integer from access.membershiprole assignment where assignment.membership_id=membership.id
            and assignment.effective_at<=clock_timestamp()
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) active_roles,
          (select count(*)::integer from access.scopegrant grantrow where grantrow.membership_id=membership.id
            and grantrow.effective_at<=clock_timestamp()
            and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp())) active_scopes,
          (select count(*)::integer from access.membershipoverride activeoverride
            where activeoverride.membership_id=membership.id and activeoverride.revoked_at is null
              and activeoverride.effective_at<=clock_timestamp()
              and (activeoverride.expires_at is null or activeoverride.expires_at>clock_timestamp())) active_overrides,
          (select count(*)::integer from audit.record record
            where record.id='audit:zhudatuan:owner-bootstrap:v1'
              and record.action='identity.owner.legacy_rehydrated') recovery_audits
          from access.membership membership join member.profile profile on profile.id=membership.member_id
          join identity.principal principal on principal.id=profile.principal_id
          where membership.id='membership-platform-owner-ethan-v1'`,['6'.repeat(64)]);
        const row=rehydrated.rows[0];
        if (!row || row.member_id!==legacyTombstone.rows[0].member_id
          || row.principal_id!==legacyTombstone.rows[0].principal_id
          || row.organization_id!=='tenant-zhudatuan' || row.client!=='operator' || row.status!=='active'
          || row.profile_status!=='active' || row.principal_status!=='active' || row.active_passwords!==1
          || row.revoked_aliases!==legacyTombstone.rows[0].revoked_aliases || row.live_siblings!==0
          || row.active_roles!==2 || row.active_scopes!==3 || row.active_overrides!==0 || row.recovery_audits!==1) {
          throw new Error(`PLATFORM_OWNER_LEGACY_TOMBSTONE_REHYDRATION_INVALID:${JSON.stringify(row??null)}`);
        }
      }
      await database.exec('set local session authorization zhudatuanbootstrap;');
      const activeBootstrapState=await database.query(`select * from deployment.zhudatuan_owner_bootstrap_state($1)`,
        ['registration-fresh-replay-sentinel-not-for-production']);
      const replayed=await database.query(`select deployment.bootstrap_zhudatuan_owner($1,$2,$3,$4,$5) state`,[
        'registration-fresh-replay-sentinel-not-for-production','9'.repeat(64),
        `scrypt$v1$32768$8$1$${'C'.repeat(22)}$${'D'.repeat(86)}`,
        'e'.repeat(64),'bootstrap:owner-transfer-replay',
      ]);
      await database.exec('reset session authorization');
      if (activeBootstrapState.rows[0]?.state!=='active'
        || activeBootstrapState.rows[0]?.active_owner_count!==1
        || activeBootstrapState.rows[0]?.membership_id!=='membership-platform-owner-ethan-v1'
        || activeBootstrapState.rows[0]?.current_owner_valid!==true
        || activeBootstrapState.rows[0]?.fixed_identity_collision!==false
        || replayed.rows[0]?.state!=='existing') {
        throw new Error(`PLATFORM_OWNER_BOOTSTRAP_IDEMPOTENCY_INVALID:${JSON.stringify({
          state:activeBootstrapState.rows[0]??null,replayed:replayed.rows[0]??null})}`);
      }
      const credentialUnchanged=await database.query(`select count(*)::integer count from identity.credential
        where provider='password' and status='active' and subject_hash=$1`,['6'.repeat(64)]);
      if (credentialUnchanged.rows[0]?.count!==1) throw new Error('PLATFORM_OWNER_BOOTSTRAP_REPLAY_ROTATED_SECRET');
    }
    const owner=await database.query(`select owner.membership_id membership,owner.version,
      membership.access_version,profile.principal_id principal from access.platformowner owner
      join access.membership membership on membership.id=owner.membership_id
      join member.profile profile on profile.id=membership.member_id where owner.singleton=true and owner.state='active'`);
    let source=owner.rows[0];
    if (!source) throw new Error('PLATFORM_OWNER_TRANSFER_SOURCE_MISSING');
    await verifyOperatorRegistrationSubjectBoundary(database,source.membership);
    const mobileState=await database.query(`select profile.mobile_ciphertext is not null
        and profile.mobile_token is not null mobile_ready,principal.credential_version
      from access.platformowner owner join access.membership membership on membership.id=owner.membership_id
      join member.profile profile on profile.id=membership.member_id
      join identity.principal principal on principal.id=profile.principal_id where owner.singleton=true`);
    if (!mobileState.rows[0]?.mobile_ready) {
      const sessionHash=createHash('sha256').update('session:owner-transfer-mobile-enrolment').digest('hex');
      const subjectHash='8'.repeat(64);
      const mobileToken='b'.repeat(64);
      await database.query(`insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
        values('assurance:owner-transfer-password',$1,'password',2,$2,clock_timestamp(),clock_timestamp()+interval '10 minutes')`,
      [source.principal,sessionHash]);
      await database.query(`insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,
          ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
        values('session:owner-transfer-mobile-enrolment',$1,$2,$3,$4,$5,'operator',$6,'contract','mobile-enrolment',2,
          clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp())`,
      [source.principal,source.membership,'c'.repeat(64),mobileState.rows[0].credential_version,
        source.access_version,'d'.repeat(64)]);
      await database.query(`insert into identity.challenge(id,principal_id,purpose,destination_hash,session_hash,code_hash,attempts,
          expires_at,consumed_at,created_at)
        values('challenge:owner-transfer-mobile-cross-session',$1,'phone_change',$2,$3,$4,0,
          clock_timestamp()+interval '10 minutes',clock_timestamp(),clock_timestamp()),
          ('challenge:owner-transfer-mobile-enrolment',$1,'phone_change',$5,$6,$7,0,
          clock_timestamp()+interval '10 minutes',clock_timestamp(),clock_timestamp())`,
      [source.principal,'9'.repeat(64),'e'.repeat(64),'f'.repeat(64),subjectHash,sessionHash,'0'.repeat(64)]);
      await expectOwnerTransferRejection(database,`select access.change_zhudatuan_owner_mobile($1,
        'session:owner-transfer-mobile-enrolment','challenge:owner-transfer-mobile-cross-session',
        'kms:fake-session-owner-mobile',$2,$3,'134****0000',$4,$4)`,
      [source.principal,'9'.repeat(64),mobileToken,'e'.repeat(64)],'OWNER_MOBILE_CHANGE_FORBIDDEN',source.membership,source.principal);
      await expectOwnerTransferRejection(database,`select access.change_zhudatuan_owner_mobile($1,
        'session:owner-transfer-mobile-enrolment','challenge:owner-transfer-mobile-cross-session',
        'kms:cross-session-owner-mobile',$2,$3,'134****0000',$4,$4)`,
      [source.principal,'9'.repeat(64),mobileToken,sessionHash],'OWNER_MOBILE_CHALLENGE_INVALID',source.membership,source.principal);
      await expectOwnerTransferRejection(database,`select access.change_zhudatuan_owner_mobile($1,
        'session:owner-transfer-mobile-enrolment','challenge:owner-transfer-mobile-enrolment',
        'kms:swapped-owner-mobile',$2,$3,'134****0000',$4,$4)`,
      [source.principal,mobileToken,subjectHash,sessionHash],'OWNER_MOBILE_CHALLENGE_INVALID',source.membership,source.principal);
      const changed=await callOwnerTransfer(database,source.membership,source.principal,
        `select access.change_zhudatuan_owner_mobile($1,'session:owner-transfer-mobile-enrolment',
          'challenge:owner-transfer-mobile-enrolment','kms:contract-owner-mobile',$2,$3,'134****7586',$4,$4) mobile`,
        [source.principal,subjectHash,mobileToken,sessionHash]);
      const mobileEvidence=await database.query(`select
        profile.mobile_ciphertext='kms:contract-owner-mobile' and profile.mobile_token=$1 mobile_ready,
        credential.subject_hash=$2 credential_rotated,
        exists(select 1 from identity.assurance where principal_id=principal.id and method='phone_otp'
          and evidence_hash=$2) assurance_subject_bound,
        principal.credential_version=$3::bigint+1 credential_version_rotated,
        session.revoked_reason enrolment_session_reason,
        exists(select 1 from runtime.outbox where event_type='identity.session.revoked'
          and aggregate_id='session:owner-transfer-mobile-enrolment' and payload->>'reason'='mobile_changed') audited
        from access.platformowner owner join access.membership membership on membership.id=owner.membership_id
        join member.profile profile on profile.id=membership.member_id
        join identity.principal principal on principal.id=profile.principal_id
        join identity.credential credential on credential.principal_id=principal.id and credential.provider='password'
        join identity.session session on session.id='session:owner-transfer-mobile-enrolment'
        where owner.singleton=true`,[mobileToken,subjectHash,mobileState.rows[0].credential_version]);
      if (!changed.rows[0]?.mobile || !mobileEvidence.rows[0]?.mobile_ready
        || !mobileEvidence.rows[0]?.credential_rotated || !mobileEvidence.rows[0]?.assurance_subject_bound
        || !mobileEvidence.rows[0]?.credential_version_rotated
        || mobileEvidence.rows[0]?.enrolment_session_reason!=='mobile_changed' || !mobileEvidence.rows[0]?.audited) {
        throw new Error(`PLATFORM_OWNER_MOBILE_ENROLMENT_INVALID:${JSON.stringify({
          result:changed.rows[0]??null,evidence:mobileEvidence.rows[0]??null})}`);
      }
      source={...source,credential_version:Number(mobileState.rows[0].credential_version)+1};
    } else {
      source={...source,credential_version:Number(mobileState.rows[0].credential_version)};
    }
    const mobileStaleSession='session:owner-mobile-stepup-stale';
    const mobileNullSession='session:owner-mobile-stepup-null-expiry';
    const mobileStaleSessionHash=createHash('sha256').update(mobileStaleSession).digest('hex');
    const mobileNullSessionHash=createHash('sha256').update(mobileNullSession).digest('hex');
    await database.query(`insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,
        access_version,client,ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at) values
      ($1,$2,$3,$4,$5,$6,'operator',$7,'contract','owner-mobile-stale',3,
        clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
      ($8,$2,$3,$9,$5,$6,'operator',$10,'contract','owner-mobile-null-expiry',3,
        clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp())`,[
      mobileStaleSession,source.principal,source.membership,
      createHash('sha256').update('token:owner-mobile-stale').digest('hex'),source.credential_version,
      source.access_version,createHash('sha256').update('ip:owner-mobile-stale').digest('hex'),mobileNullSession,
      createHash('sha256').update('token:owner-mobile-null-expiry').digest('hex'),
      createHash('sha256').update('ip:owner-mobile-null-expiry').digest('hex'),
    ]);
    await database.query(`insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at) values
      ('assurance:owner-mobile-stepup-stale',$1,'otp',3,$2,clock_timestamp()-interval '16 minutes',
        clock_timestamp()+interval '15 minutes'),
      ('assurance:owner-mobile-stepup-null-expiry',$1,'otp',3,$3,clock_timestamp(),null)`,[
      source.principal,mobileStaleSessionHash,mobileNullSessionHash,
    ]);
    await database.query(`insert into identity.challenge(id,principal_id,purpose,destination_hash,session_hash,code_hash,attempts,
        expires_at,consumed_at,created_at) values
      ('challenge:owner-mobile-stepup-stale',$1,'phone_change',$4,$2,'contract-code',1,
        clock_timestamp()+interval '10 minutes',clock_timestamp(),clock_timestamp()),
      ('challenge:owner-mobile-stepup-null-expiry',$1,'phone_change',$5,$3,'contract-code',1,
        clock_timestamp()+interval '10 minutes',clock_timestamp(),clock_timestamp())`,[
      source.principal,mobileStaleSessionHash,mobileNullSessionHash,'c'.repeat(64),'d'.repeat(64),
    ]);
    for (const [suffix,session,challenge,subjectHash,sessionHash] of [
      ['stale',mobileStaleSession,'challenge:owner-mobile-stepup-stale','c'.repeat(64),mobileStaleSessionHash],
      ['null-expiry',mobileNullSession,'challenge:owner-mobile-stepup-null-expiry','d'.repeat(64),mobileNullSessionHash],
    ]) {
      await expectOwnerTransferRejection(database,`select access.change_zhudatuan_owner_mobile($1,$2,$3,$4,$5,$6,
        '138****0000',$7,$7)`,[source.principal,session,challenge,`kms:owner-mobile-${suffix}`,subjectHash,
        'e'.repeat(64),sessionHash],'OWNER_MOBILE_STEPUP_REQUIRED',source.membership,source.principal);
    }
    const passwordHashOne=`scrypt$v1$32768$8$1$${'A'.repeat(22)}$${'B'.repeat(86)}`;
    const passwordHashTwo=`scrypt$v1$32768$8$1$${'C'.repeat(22)}$${'D'.repeat(86)}`;
    const ordinaryPassword=await callOwnerTransfer(database,source.membership,source.principal,
      `select identity.rotate_zhudatuan_owner_password(
        'principal:not-the-owner',null,null,$1,'credential_changed') rotated`,[passwordHashOne]);
    if (ordinaryPassword.rows[0]?.rotated!==null) throw new Error('OWNER_PASSWORD_NON_OWNER_FALLBACK_INVALID');
    await expectOwnerTransferRejection(database,`update identity.credential set secret_hash=$1
      where principal_id=$2 and provider='password' and status='active'`,
    [passwordHashOne,source.principal],'ZHUDATUAN_OWNER_PROTECTED',source.membership,source.principal);
    await expectOwnerTransferRejection(database,`update access.rolepermission set effect=effect
      where role_id='role-platform-owner-v2'`,[],
    'ZHUDATUAN_OWNER_PROTECTED',source.membership,source.principal);
    await database.query(`insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,
        access_version,client,ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
      values('session:owner-password-change',$1,$2,$3,$4,$5,'operator',$6,'contract','owner-password',2,
        clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp())`,
    [source.principal,source.membership,
      createHash('sha256').update('token:session:owner-password-change').digest('hex'),
      source.credential_version,source.access_version,
      createHash('sha256').update('ip:session:owner-password-change').digest('hex')]);
    await database.query(`insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
      values('assurance:owner-password-change',$1,'password',2,$2,clock_timestamp(),clock_timestamp()+interval '10 minutes')`,
    [source.principal,createHash('sha256').update('session:owner-password-change').digest('hex')]);
    const passwordChanged=await callOwnerTransfer(database,source.membership,source.principal,
      `select identity.rotate_zhudatuan_owner_password($1,'session:owner-password-change',null,$2,
        'credential_changed') rotated`,[source.principal,passwordHashOne]);
    const changedPasswordEvidence=await database.query(`select
      (select secret_hash=$1 from identity.credential where principal_id=$2 and provider='password' and status='active') secret_rotated,
      (select credential_version=$3::bigint+1 from identity.principal where id=$2) version_rotated,
      (select revoked_reason='credential_changed' from identity.session where id='session:owner-password-change') session_revoked`,
    [passwordHashOne,source.principal,source.credential_version]);
    if (!passwordChanged.rows[0]?.rotated || !changedPasswordEvidence.rows[0]?.secret_rotated
      || !changedPasswordEvidence.rows[0]?.version_rotated || !changedPasswordEvidence.rows[0]?.session_revoked) {
      throw new Error(`OWNER_PASSWORD_CHANGE_INVALID:${JSON.stringify({
        result:passwordChanged.rows[0]??null,evidence:changedPasswordEvidence.rows[0]??null})}`);
    }
    source={...source,credential_version:Number(source.credential_version)+1};
    await database.query(`insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,attempts,
        expires_at,consumed_at,created_at) values('challenge:owner-password-reset',$1,'password_reset',$2,$3,0,
        clock_timestamp()+interval '10 minutes',clock_timestamp(),clock_timestamp())`,
    [source.principal,'6'.repeat(64),'7'.repeat(64)]);
    const passwordReset=await callOwnerTransfer(database,source.membership,source.principal,
      `select identity.rotate_zhudatuan_owner_password($1,null,'challenge:owner-password-reset',$2,
        'credential_reset') rotated`,[source.principal,passwordHashTwo]);
    const resetPasswordEvidence=await database.query(`select
      (select secret_hash=$1 from identity.credential where principal_id=$2 and provider='password' and status='active') secret_rotated,
      (select credential_version=$3::bigint+1 from identity.principal where id=$2) version_rotated`,
    [passwordHashTwo,source.principal,source.credential_version]);
    if (!passwordReset.rows[0]?.rotated || !resetPasswordEvidence.rows[0]?.secret_rotated
      || !resetPasswordEvidence.rows[0]?.version_rotated) {
      throw new Error(`OWNER_PASSWORD_RESET_INVALID:${JSON.stringify({
        result:passwordReset.rows[0]??null,evidence:resetPasswordEvidence.rows[0]??null})}`);
    }
    source={...source,credential_version:Number(source.credential_version)+1};
    await database.exec(`
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version) values
      ('principal:owner-transfer-target','active',1,clock_timestamp(),clock_timestamp(),0),
      ('principal:owner-transfer-pending','active',1,clock_timestamp(),clock_timestamp(),0),
      ('principal:owner-transfer-expiry','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at) values
      ('credential:owner-transfer-target','principal:owner-transfer-target','password','${'e'.repeat(64)}','contract-target-secret','active',clock_timestamp()),
      ('credential:owner-transfer-pending','principal:owner-transfer-pending','password','${'f'.repeat(64)}','contract-pending-secret','active',clock_timestamp()),
      ('credential:owner-transfer-expiry','principal:owner-transfer-expiry','password','${'7'.repeat(64)}','contract-expiry-secret','active',clock_timestamp());
    insert into member.profile(id,principal_id,display_name,mobile_ciphertext,mobile_token,mobile_masked,status,created_at,updated_at,version) values
      ('member:owner-transfer-target','principal:owner-transfer-target','Transfer Target','kms:target','${'e'.repeat(64)}','135****0001','active',clock_timestamp(),clock_timestamp(),0),
      ('member:owner-transfer-pending','principal:owner-transfer-pending','Pending Only','kms:pending','${'f'.repeat(64)}','135****0002','active',clock_timestamp(),clock_timestamp(),0),
      ('member:owner-transfer-expiry','principal:owner-transfer-expiry','Expiry Target','kms:expiry','${'7'.repeat(64)}','135****0003','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at) values
      ('membership:owner-transfer-target','member:owner-transfer-target','tenant-zhudatuan','operator','active',5,clock_timestamp()),
      ('membership:owner-transfer-target-storefront','member:owner-transfer-target','tenant-zhudatuan','storefront','active',4,clock_timestamp()),
      ('membership:owner-transfer-pending','member:owner-transfer-pending','tenant-zhudatuan','operator','active',3,clock_timestamp()),
      ('membership:owner-transfer-expiry','member:owner-transfer-expiry','tenant-zhudatuan','operator','active',7,clock_timestamp());
    insert into access.membershiprole(membership_id,role_id,effective_at) values
      ('membership:owner-transfer-target','role:self','1970-01-01T00:00:00Z'),
      ('membership:owner-transfer-target','role:owner-transfer-test-admin','1970-01-01T00:00:00Z'),
      ('membership:owner-transfer-target-storefront','role:self','1970-01-01T00:00:00Z'),
      ('membership:owner-transfer-pending','role:self','1970-01-01T00:00:00Z'),
      ('membership:owner-transfer-pending','role-zhudatuan-pending-operator','1970-01-01T00:00:00Z'),
      ('membership:owner-transfer-expiry','role:self','1970-01-01T00:00:00Z'),
      ('membership:owner-transfer-expiry','role:owner-transfer-test-admin','1970-01-01T00:00:00Z');
    insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
      ('scope:owner-transfer-target:self','membership:owner-transfer-target','self','self:principal:owner-transfer-target','self:principal:owner-transfer-target','allow','1970-01-01T00:00:00Z',5),
      ('scope:owner-transfer-target:tenant','membership:owner-transfer-target','tenant','tenant-zhudatuan','tenant-zhudatuan','allow','1970-01-01T00:00:00Z',5),
      ('scope:owner-transfer-target-storefront:self','membership:owner-transfer-target-storefront','self','self:principal:owner-transfer-target','self:principal:owner-transfer-target','allow','1970-01-01T00:00:00Z',4),
      ('scope:owner-transfer-pending:self','membership:owner-transfer-pending','self','self:principal:owner-transfer-pending','self:principal:owner-transfer-pending','allow','1970-01-01T00:00:00Z',3),
      ('scope:owner-transfer-expiry:self','membership:owner-transfer-expiry','self','self:principal:owner-transfer-expiry','self:principal:owner-transfer-expiry','allow','1970-01-01T00:00:00Z',7),
      ('scope:owner-transfer-expiry:tenant','membership:owner-transfer-expiry','tenant','tenant-zhudatuan','tenant-zhudatuan','allow','1970-01-01T00:00:00Z',7);
    insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,
      user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at) values
      ('session:owner-transfer-source','${source.principal}','${source.membership}','${'1'.repeat(64)}',${source.credential_version},${source.access_version},'operator','${'2'.repeat(64)}','contract','source',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
      ('session:owner-transfer-source-unbound','${source.principal}','${source.membership}','${'6'.repeat(64)}',${source.credential_version},${source.access_version},'operator','${'0'.repeat(64)}','contract','source-unbound',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
      ('session:owner-transfer-source-stale','${source.principal}','${source.membership}','${'24'.repeat(32)}',${source.credential_version},${source.access_version},'operator','${'a'.repeat(64)}','contract','source-stale',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
      ('session:owner-transfer-source-null-expiry','${source.principal}','${source.membership}','${'42'.repeat(32)}',${source.credential_version},${source.access_version},'operator','${'b'.repeat(64)}','contract','source-null-expiry',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
      ('session:owner-transfer-target','principal:owner-transfer-target','membership:owner-transfer-target','${'3'.repeat(64)}',1,5,'operator','${'4'.repeat(64)}','contract','target',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
      ('session:owner-transfer-expiry','principal:owner-transfer-expiry','membership:owner-transfer-expiry','${'7'.repeat(64)}',1,7,'operator','${'8'.repeat(64)}','contract','expiry',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp());`);
    await database.query(`insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at) values
      ('assurance:owner-transfer-source-l3',$1,'otp',3,$2,clock_timestamp(),clock_timestamp()+interval '15 minutes'),
      ('assurance:owner-transfer-target-l3','principal:owner-transfer-target','otp',3,$3,clock_timestamp(),clock_timestamp()+interval '15 minutes'),
      ('assurance:owner-transfer-expiry-l3','principal:owner-transfer-expiry','otp',3,$4,clock_timestamp(),clock_timestamp()+interval '15 minutes'),
      ('assurance:owner-transfer-source-stale',$1,'otp',3,$5,clock_timestamp()-interval '16 minutes',clock_timestamp()+interval '15 minutes'),
      ('assurance:owner-transfer-source-null-expiry',$1,'otp',3,$6,clock_timestamp(),null)`,
    [source.principal,
      createHash('sha256').update('session:owner-transfer-source').digest('hex'),
      createHash('sha256').update('session:owner-transfer-target').digest('hex'),
      createHash('sha256').update('session:owner-transfer-expiry').digest('hex'),
      createHash('sha256').update('session:owner-transfer-source-stale').digest('hex'),
      createHash('sha256').update('session:owner-transfer-source-null-expiry').digest('hex')]);
    const sessionBinding=await database.query(`select
      (select assurance_level::integer from identity.resolve_session($1)) bound_level,
      (select assurance_level::integer from identity.resolve_session($2)) unbound_level,
      (select assurance_level::integer from identity.resolve_session($3)) stale_level,
      (select assurance_level::integer from identity.resolve_session($4)) null_expiry_level`,
    ['1'.repeat(64),'6'.repeat(64),'24'.repeat(32),'42'.repeat(32)]);
    if (sessionBinding.rows[0]?.bound_level!==3 || sessionBinding.rows[0]?.unbound_level!==2
      || sessionBinding.rows[0]?.stale_level!==2 || sessionBinding.rows[0]?.null_expiry_level!==2) {
      throw new Error(`OWNER_STEPUP_SESSION_BINDING_INVALID:${JSON.stringify(sessionBinding.rows[0]??null)}`);
    }
    for (const [suffix,session,nonce] of [
      ['stale','session:owner-transfer-source-stale','owner-proof:00000000-0000-4000-8000-000000000130'],
      ['null-expiry','session:owner-transfer-source-null-expiry','owner-proof:00000000-0000-4000-8000-000000000131'],
    ]) {
      await insertOwnerProof(database,{ nonce,action:'create',actor:source.principal,session,
        source:source.membership,target:'membership:owner-transfer-expiry',mode:'remove_admin',role:null,roleVersion:null,
        ownershipVersion:source.version,transferVersion:null,targetVersion:7,reasonHash:null });
      await expectOwnerTransferRejection(database,`select access.create_owner_transfer(
        'owner-transfer:${suffix}-assurance',$1,'${session}',$2,$3,7)`,
      [source.principal,nonce,source.version],'OWNER_TRANSFER_FORBIDDEN',source.membership,source.principal);
    }
    const resolved=await database.query(`select
      (select scope->>'id' from access.resolve_scope('membership:owner-transfer-target','access.ownership.read','organization-platform-root')) target_scope,
      (select scope is null from access.resolve_scope('membership:owner-transfer-missing','access.ownership.read','organization-platform-root')) missing_denied`);
    if (JSON.stringify(resolved.rows[0])!==JSON.stringify({target_scope:'principal:owner-transfer-target',missing_denied:true})) {
      throw new Error(`PLATFORM_OWNER_TRANSFER_SELF_SCOPE_INVALID:${JSON.stringify(resolved.rows[0])}`);
    }
    const ownerProjection=await database.query(`select
      coalesce(bool_or((grantrow->'permissions')?'access.ownership.read'),false) ownership_read,
      coalesce(bool_or((grantrow->'permissions')?'access.ownership.transfer'),false) ownership_transfer,
      coalesce(bool_or((grantrow->'permissions')?'access.ownership.accept'),false) ownership_accept
      from access.resolve_membership('${source.membership}') resolved
      cross join lateral jsonb_array_elements(resolved.grants) grantrow
      where grantrow->'scope'->>'id'='${source.principal}'`);
    const plainAdminProjection=await database.query(`select coalesce(bool_or(
      ((grantrow->'permissions')?'access.ownership.read')
      or ((grantrow->'permissions')?'access.ownership.transfer')
      or ((grantrow->'permissions')?'access.ownership.accept')),false) ownership_projected
      from access.resolve_membership('membership:owner-transfer-target') resolved
      cross join lateral jsonb_array_elements(resolved.grants) grantrow
      where grantrow->'scope'->>'id'='principal:owner-transfer-target'`);
    const ownerPlatformOperations=await database.query(`select not exists(
      select required.operation_id from (values
        ('channel.distributors.create'),('extension.installations.read')) required(operation_id)
      except select operation_id from capability.membership_operations($1)) allowed`,[source.membership]);
    await database.exec(`select set_config('app.scope_id','organization-platform-root',true)`);
    const plainAdminPlatform=await database.query(`select
      coalesce(bool_or(grantrow->'scope'->>'id'='organization-platform-root'
        and (((grantrow->'permissions')?'channel.distributor.manage')
          or ((grantrow->'permissions')?'extension.installation.read'))),false) platform_permission,
      exists(select 1 from capability.membership_operations('membership:owner-transfer-target') available
        where available.operation_id in('channel.distributors.create','extension.installations.read')) real_operation,
      (select scope->>'id' from access.resolve_scope('membership:owner-transfer-target',
        'channel.distributors.create','organization-platform-root')) resolved_scope
      from access.resolve_membership('membership:owner-transfer-target') resolved
      cross join lateral jsonb_array_elements(resolved.grants) grantrow`);
    if (JSON.stringify(ownerProjection.rows[0])!==JSON.stringify({ownership_read:true,ownership_transfer:true,ownership_accept:true})
      || ownerPlatformOperations.rows[0]?.allowed!==true
      || plainAdminProjection.rows[0]?.ownership_projected!==false
      || plainAdminPlatform.rows[0]?.platform_permission!==false
      || plainAdminPlatform.rows[0]?.real_operation!==false
      || plainAdminPlatform.rows[0]?.resolved_scope!=='organization-platform-root') {
      throw new Error(`PLATFORM_OWNER_TRANSFER_PERMISSION_PROJECTION_INVALID:${JSON.stringify({
        owner:ownerProjection.rows[0]??null,plainAdmin:plainAdminProjection.rows[0]??null,
        ownerPlatformOperations:ownerPlatformOperations.rows[0]??null,
        plainAdminPlatform:plainAdminPlatform.rows[0]??null})}`);
    }

    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000120',action:'create',actor:source.principal,
      session:'session:owner-transfer-source-unbound',source:source.membership,target:'membership:owner-transfer-expiry',mode:'remove_admin',
      role:null,roleVersion:null,ownershipVersion:source.version,transferVersion:null,targetVersion:7,reasonHash:null });
    await expectOwnerTransferRejection(database,`select access.create_owner_transfer('owner-transfer:cross-session-source',$1,
      'session:owner-transfer-source-unbound','owner-proof:00000000-0000-4000-8000-000000000120',$2,7)`,
    [source.principal,source.version],'OWNER_TRANSFER_FORBIDDEN',source.membership,source.principal);

    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000101',action:'create',actor:'principal:owner-transfer-target',
      session:'session:owner-transfer-target',source:'membership:owner-transfer-target',target:'membership:owner-transfer-expiry',mode:'remove_admin',
      role:null,roleVersion:null,ownershipVersion:source.version,transferVersion:null,targetVersion:7,reasonHash:null });
    await expectOwnerTransferRejection(database,`select access.create_owner_transfer('owner-transfer:pointer-spoof',$1,
      'session:owner-transfer-target','owner-proof:00000000-0000-4000-8000-000000000101',$2,7)`,
    ['principal:owner-transfer-target',source.version],'OWNER_TRANSFER_FORBIDDEN','membership:owner-transfer-target','principal:owner-transfer-target');

    await database.exec(`update member.profile set status='disabled' where id='member:owner-transfer-target'`);
    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000102',action:'create',actor:source.principal,
      session:'session:owner-transfer-source',source:source.membership,target:'membership:owner-transfer-target',mode:'remove_admin',
      role:null,roleVersion:null,ownershipVersion:source.version,transferVersion:null,targetVersion:5,reasonHash:null });
    await expectOwnerTransferRejection(database,`select access.create_owner_transfer('owner-transfer:disabled-profile',$1,
      'session:owner-transfer-source','owner-proof:00000000-0000-4000-8000-000000000102',$2,5)`,
    [source.principal,source.version],'OWNER_TRANSFER_TARGET_INVALID',source.membership,source.principal);
    await database.exec(`update member.profile set status='active' where id='member:owner-transfer-target';
      update identity.principal set status='disabled' where id='principal:owner-transfer-target'`);
    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000103',action:'create',actor:source.principal,
      session:'session:owner-transfer-source',source:source.membership,target:'membership:owner-transfer-target',mode:'remove_admin',
      role:null,roleVersion:null,ownershipVersion:source.version,transferVersion:null,targetVersion:5,reasonHash:null });
    await expectOwnerTransferRejection(database,`select access.create_owner_transfer('owner-transfer:disabled-principal',$1,
      'session:owner-transfer-source','owner-proof:00000000-0000-4000-8000-000000000103',$2,5)`,
    [source.principal,source.version],'OWNER_TRANSFER_TARGET_INVALID',source.membership,source.principal);
    await database.exec(`update identity.principal set status='active' where id='principal:owner-transfer-target'`);

    await database.exec(`insert into access.role(id,scope_id,name,status,version)
      values('role:owner-transfer-readiness-deny','tenant-zhudatuan','Readiness deny','active',1);
      insert into access.rolepermission(role_id,permission_id,effect)
      select 'role:owner-transfer-readiness-deny',id,'deny' from access.permission
      where code='identity.assurance.manage';
      insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by)
      values('membership:owner-transfer-target','role:owner-transfer-readiness-deny',clock_timestamp(),'contract');`);
    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000110',action:'create',actor:source.principal,
      session:'session:owner-transfer-source',source:source.membership,target:'membership:owner-transfer-target',mode:'remove_admin',
      role:null,roleVersion:null,ownershipVersion:source.version,transferVersion:null,targetVersion:5,reasonHash:null });
    await expectOwnerTransferRejection(database,`select access.create_owner_transfer('owner-transfer:active-role-deny',$1,
      'session:owner-transfer-source','owner-proof:00000000-0000-4000-8000-000000000110',$2,5)`,
    [source.principal,source.version],'OWNER_TRANSFER_TARGET_INVALID',source.membership,source.principal);
    await database.exec(`update access.role set status='disabled' where id='role:owner-transfer-readiness-deny';
      insert into access.membershipoverride(membership_id,permission_id,effect,granted_by,reason,effective_at)
      select 'membership:owner-transfer-target',id,'deny','contract','readiness deny',clock_timestamp()
      from access.permission where code='access.ownership.accept';`);
    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000111',action:'create',actor:source.principal,
      session:'session:owner-transfer-source',source:source.membership,target:'membership:owner-transfer-target',mode:'remove_admin',
      role:null,roleVersion:null,ownershipVersion:source.version,transferVersion:null,targetVersion:5,reasonHash:null });
    await expectOwnerTransferRejection(database,`select access.create_owner_transfer('owner-transfer:override-deny',$1,
      'session:owner-transfer-source','owner-proof:00000000-0000-4000-8000-000000000111',$2,5)`,
    [source.principal,source.version],'OWNER_TRANSFER_TARGET_INVALID',source.membership,source.principal);
    await database.exec(`update access.membershipoverride set revoked_at=clock_timestamp()
      where membership_id='membership:owner-transfer-target'
        and permission_id=(select id from access.permission where code='access.ownership.accept')`);

    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000104',action:'create',actor:source.principal,
      session:'session:owner-transfer-source',source:source.membership,target:'membership:owner-transfer-expiry',mode:'remove_admin',
      role:null,roleVersion:null,ownershipVersion:source.version,transferVersion:null,targetVersion:7,reasonHash:null });
    await callOwnerTransfer(database,source.membership,source.principal,`select access.create_owner_transfer(
      'owner-transfer:expiry',$1,'session:owner-transfer-source','owner-proof:00000000-0000-4000-8000-000000000104',$2,7)`,
    [source.principal,source.version]);
    await database.exec(`update access.ownertransfer set requested_at=statement_timestamp()-interval '8 days',
      cooling_until=statement_timestamp()-interval '7 days',expires_at=statement_timestamp()-interval '1 day'
      where id='owner-transfer:expiry';
      insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,
        ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
      values('session:owner-transfer-expiry-after-request','principal:owner-transfer-expiry','membership:owner-transfer-expiry',
        '${'9'.repeat(64)}',1,8,'operator','${'a'.repeat(64)}','contract','expiry-after-request',3,
        clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp());`);
    const expiredCount=await callOwnerTransfer(database,source.membership,source.principal,
      `select access.expire_owner_transfers() changed`,[]);
    const expired=await database.query(`select transfer.state,transfer.version::integer version,
      not exists(select 1 from access.membershiprole role where role.membership_id=transfer.target_membership_id
        and role.role_id='role-platform-owner-successor-v1' and role.effective_at<=clock_timestamp()
        and (role.expires_at is null or role.expires_at>clock_timestamp())) successor_cleared,
      membership.access_version::integer access_version,
      (select revoked_reason from identity.session where id='session:owner-transfer-expiry') requested_reason,
      (select revoked_reason from identity.session where id='session:owner-transfer-expiry-after-request') expired_reason
      from access.ownertransfer transfer join access.membership membership on membership.id=transfer.target_membership_id
      where transfer.id='owner-transfer:expiry'`);
    const expiredRow=expired.rows[0];
    if (expiredCount.rows[0]?.changed!==1 || !expiredRow || expiredRow.state!=='expired' || expiredRow.version!==2
      || !expiredRow.successor_cleared || expiredRow.access_version!==9
      || expiredRow.requested_reason!=='owner_transfer_requested' || expiredRow.expired_reason!=='owner_transfer_expired') {
      throw new Error(`PLATFORM_OWNER_TRANSFER_EXPIRY_INVALID:${JSON.stringify({changed:expiredCount.rows[0],transfer:expiredRow??null})}`);
    }

    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000001',action:'create',actor:source.principal,
      session:'session:owner-transfer-source',source:source.membership,target:'membership:owner-transfer-pending',mode:'remove_admin',
      role:null,roleVersion:null,ownershipVersion:source.version,transferVersion:null,targetVersion:3,reasonHash:null });
    await expectOwnerTransferRejection(database,`select access.create_owner_transfer('owner-transfer:pending-only',$1,
      'session:owner-transfer-source','owner-proof:00000000-0000-4000-8000-000000000001',$2,3)`,
    [source.principal,source.version],'OWNER_TRANSFER_TARGET_INVALID',source.membership,source.principal);

    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000002',action:'create',actor:source.principal,
      session:'session:owner-transfer-source',source:source.membership,target:'membership:owner-transfer-target',mode:'retain_admin',
      role:'role:owner-transfer-test-admin',roleVersion:1,ownershipVersion:source.version,transferVersion:null,targetVersion:5,reasonHash:null });
    await callOwnerTransfer(database,source.membership,source.principal,`select access.create_owner_transfer(
      'owner-transfer:contract',$1,'session:owner-transfer-source','owner-proof:00000000-0000-4000-8000-000000000002',$2,5) transfer`,
    [source.principal,source.version]);
    const pending=await database.query(`select transfer.state,transfer.cooling_until=transfer.requested_at+interval '24 hours' cooling_exact,
      transfer.expires_at=transfer.requested_at+interval '7 days' expiry_exact,owner.membership_id owner,
      (select count(*)::integer from access.membershiprole where membership_id=transfer.target_membership_id
        and role_id='role-platform-owner-successor-v1' and expires_at>clock_timestamp()) successor
      from access.ownertransfer transfer cross join access.platformowner owner where transfer.id='owner-transfer:contract'`);
    if (JSON.stringify(pending.rows[0])!==JSON.stringify({state:'pending_acceptance',cooling_exact:true,expiry_exact:true,
      owner:source.membership,successor:1})) throw new Error(`PLATFORM_OWNER_TRANSFER_PENDING_INVALID:${JSON.stringify(pending.rows[0])}`);
    await database.exec(`set local role shopapp;
      select set_config('app.workload','api',true),set_config('app.membership_id','membership:owner-transfer-target',true),
        set_config('app.actor_id','principal:wrong',true),set_config('app.scope_id','self:principal:wrong',true);`);
    const rlsWrongActor=await database.query(`select count(*)::integer count from access.ownertransfer
      where id='owner-transfer:contract'`);
    await database.exec(`select set_config('app.actor_id','principal:owner-transfer-target',true),
      set_config('app.scope_id','self:principal:owner-transfer-target',true);`);
    const rlsTarget=await database.query(`select count(*)::integer count from access.ownertransfer
      where id='owner-transfer:contract'`);
    await database.exec('reset role');
    if (rlsWrongActor.rows[0]?.count!==0 || rlsTarget.rows[0]?.count!==1) {
      throw new Error(`PLATFORM_OWNER_TRANSFER_RLS_BINDING_INVALID:${JSON.stringify({
        wrong:rlsWrongActor.rows[0],target:rlsTarget.rows[0]})}`);
    }

    const successorProjection=await database.query(`select
      coalesce(bool_or((grantrow->'permissions')?'access.ownership.read'),false) ownership_read,
      coalesce(bool_or((grantrow->'permissions')?'access.ownership.transfer'),false) ownership_transfer,
      coalesce(bool_or((grantrow->'permissions')?'access.ownership.accept'),false) ownership_accept
      from access.resolve_membership('membership:owner-transfer-target') resolved
      cross join lateral jsonb_array_elements(resolved.grants) grantrow
      where grantrow->'scope'->>'id'='principal:owner-transfer-target'`);
    if (JSON.stringify(successorProjection.rows[0])!==JSON.stringify({
      ownership_read:true,ownership_transfer:false,ownership_accept:true})) {
      throw new Error(`PLATFORM_OWNER_SUCCESSOR_PERMISSION_PROJECTION_INVALID:${JSON.stringify(successorProjection.rows[0])}`);
    }

    const targetVersionAfterCreate=Number((await database.query(`select access_version from access.membership
      where id='membership:owner-transfer-target'`)).rows[0]?.access_version);
    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000003',action:'accept',actor:'principal:owner-transfer-target',
      session:'session:owner-transfer-target',source:source.membership,target:'membership:owner-transfer-target',mode:'retain_admin',
      role:'role:owner-transfer-test-admin',roleVersion:1,ownershipVersion:source.version,transferVersion:1,
      targetVersion:targetVersionAfterCreate,reasonHash:null });
    await expectOwnerTransferRejection(database,`select access.commit_owner_transfer('owner-transfer:contract',
      'principal:owner-transfer-target','session:owner-transfer-target','owner-proof:00000000-0000-4000-8000-000000000003',1,$1,$2)`,
    [source.version,targetVersionAfterCreate],'OWNER_TRANSFER_COOLING_PERIOD','membership:owner-transfer-target','principal:owner-transfer-target');

    for (const [suffix,session,nonce] of [
      ['stale','session:owner-transfer-source-stale','owner-proof:00000000-0000-4000-8000-000000000132'],
      ['null-expiry','session:owner-transfer-source-null-expiry','owner-proof:00000000-0000-4000-8000-000000000133'],
    ]) {
      const reason=`${suffix} cancellation`;
      await insertOwnerProof(database,{ nonce,action:'cancel',actor:source.principal,session,
        source:source.membership,target:'membership:owner-transfer-target',mode:'retain_admin',
        role:'role:owner-transfer-test-admin',roleVersion:1,ownershipVersion:source.version,transferVersion:1,
        targetVersion:targetVersionAfterCreate,reasonHash:createHash('sha256').update(reason).digest('hex') });
      await expectOwnerTransferRejection(database,`select access.cancel_owner_transfer('owner-transfer:contract',$1,
        '${session}',$2,1,$3,$4,$5)`,[source.principal,nonce,source.version,targetVersionAfterCreate,reason],
      'OWNER_TRANSFER_FORBIDDEN',source.membership,source.principal);
    }

    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000004',action:'cancel',actor:source.principal,
      session:'session:owner-transfer-source',source:source.membership,target:'membership:owner-transfer-target',mode:'retain_admin',
      role:'role:owner-transfer-test-admin',roleVersion:1,ownershipVersion:source.version,transferVersion:1,
      targetVersion:targetVersionAfterCreate,reasonHash:createHash('sha256').update('contract cancellation').digest('hex') });
    await callOwnerTransfer(database,source.membership,source.principal,`select access.cancel_owner_transfer('owner-transfer:contract',$1,
      'session:owner-transfer-source','owner-proof:00000000-0000-4000-8000-000000000004',1,$2,$3,'contract cancellation') transfer`,
    [source.principal,source.version,targetVersionAfterCreate]);
    const cancelled=await database.query(`select transfer.state,
      not exists(select 1 from access.membershiprole where membership_id=transfer.target_membership_id
        and role_id='role-platform-owner-successor-v1' and (expires_at is null or expires_at>clock_timestamp())) successor_cleared
      from access.ownertransfer transfer where id='owner-transfer:contract'`);
    if (JSON.stringify(cancelled.rows[0])!==JSON.stringify({state:'cancelled',successor_cleared:true})) {
      throw new Error(`PLATFORM_OWNER_TRANSFER_CANCEL_INVALID:${JSON.stringify(cancelled.rows[0])}`);
    }
    await expectOwnerTransferRejection(database,`select access.cancel_owner_transfer('owner-transfer:contract',$1,
      'session:owner-transfer-source','owner-proof:00000000-0000-4000-8000-000000000004',1,$2,$3,'contract cancellation')`,
    [source.principal,source.version,targetVersionAfterCreate],'VERSION_CONFLICT',source.membership,source.principal);

    const targetVersionForRetry=Number((await database.query(`select access_version from access.membership
      where id='membership:owner-transfer-target'`)).rows[0]?.access_version);
    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000005',action:'create',actor:source.principal,
      session:'session:owner-transfer-source',source:source.membership,target:'membership:owner-transfer-target',mode:'retain_admin',
      role:'role:owner-transfer-test-admin',roleVersion:1,ownershipVersion:source.version,transferVersion:null,
      targetVersion:targetVersionForRetry,reasonHash:null });
    await callOwnerTransfer(database,source.membership,source.principal,`select access.create_owner_transfer(
      'owner-transfer:accepted',$1,'session:owner-transfer-source','owner-proof:00000000-0000-4000-8000-000000000005',$2,$3)`,
    [source.principal,source.version,targetVersionForRetry]);
    await database.exec(`reset role;
      update access.ownertransfer set requested_at=statement_timestamp()-interval '25 hours',
        cooling_until=statement_timestamp()-interval '1 hour',expires_at=statement_timestamp()+interval '143 hours'
      where id='owner-transfer:accepted';`);
    const targetVersionForAccept=Number((await database.query(`select access_version from access.membership
      where id='membership:owner-transfer-target'`)).rows[0]?.access_version);
    await database.query(`insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,
      ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
      values
      ('session:owner-transfer-target-accept','principal:owner-transfer-target','membership:owner-transfer-target',$1,1,$2,
        'operator',$3,'contract','target-accept',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
      ('session:owner-transfer-target-accept-stale','principal:owner-transfer-target','membership:owner-transfer-target',$4,1,$2,
        'operator',$5,'contract','target-accept-stale',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
      ('session:owner-transfer-target-accept-null-expiry','principal:owner-transfer-target','membership:owner-transfer-target',$6,1,$2,
        'operator',$7,'contract','target-accept-null-expiry',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp())`,
    ['5'.repeat(64),targetVersionForAccept,'6'.repeat(64),'8'.repeat(64),'9'.repeat(64),
      'a'.repeat(64),'b'.repeat(64)]);
    await database.query(`insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at) values
      ('assurance:owner-transfer-target-accept-stale','principal:owner-transfer-target','otp',3,$1,
        clock_timestamp()-interval '16 minutes',clock_timestamp()+interval '15 minutes'),
      ('assurance:owner-transfer-target-accept-null-expiry','principal:owner-transfer-target','otp',3,$2,
        clock_timestamp(),null)`,[
      createHash('sha256').update('session:owner-transfer-target-accept-stale').digest('hex'),
      createHash('sha256').update('session:owner-transfer-target-accept-null-expiry').digest('hex'),
    ]);
    for (const [suffix,session,nonce] of [
      ['stale','session:owner-transfer-target-accept-stale','owner-proof:00000000-0000-4000-8000-000000000134'],
      ['null-expiry','session:owner-transfer-target-accept-null-expiry','owner-proof:00000000-0000-4000-8000-000000000135'],
    ]) {
      await insertOwnerProof(database,{ nonce,action:'accept',actor:'principal:owner-transfer-target',session,
        source:source.membership,target:'membership:owner-transfer-target',mode:'retain_admin',
        role:'role:owner-transfer-test-admin',roleVersion:1,ownershipVersion:source.version,transferVersion:1,
        targetVersion:targetVersionForAccept,reasonHash:null });
      await expectOwnerTransferRejection(database,`select access.commit_owner_transfer('owner-transfer:accepted',
        'principal:owner-transfer-target','${session}',$1,1,$2,$3)`,
      [nonce,source.version,targetVersionForAccept],'OWNER_TRANSFER_FORBIDDEN',
      'membership:owner-transfer-target','principal:owner-transfer-target');
    }
    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000121',action:'accept',actor:'principal:owner-transfer-target',
      session:'session:owner-transfer-target-accept',source:source.membership,target:'membership:owner-transfer-target',mode:'retain_admin',
      role:'role:owner-transfer-test-admin',roleVersion:1,ownershipVersion:source.version,transferVersion:1,
      targetVersion:targetVersionForAccept,reasonHash:null });
    await expectOwnerTransferRejection(database,`select access.commit_owner_transfer('owner-transfer:accepted',
      'principal:owner-transfer-target','session:owner-transfer-target-accept',
      'owner-proof:00000000-0000-4000-8000-000000000121',1,$1,$2)`,
    [source.version,targetVersionForAccept],'OWNER_TRANSFER_FORBIDDEN','membership:owner-transfer-target','principal:owner-transfer-target');
    await database.query(`insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
      values('assurance:owner-transfer-target-accept-l3','principal:owner-transfer-target','otp',3,$1,
        clock_timestamp(),clock_timestamp()+interval '15 minutes')`,
    [createHash('sha256').update('session:owner-transfer-target-accept').digest('hex')]);
    const staleTargetVersion=targetVersionForAccept-1;
    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000106',action:'accept',actor:'principal:owner-transfer-target',
      session:'session:owner-transfer-target-accept',source:source.membership,target:'membership:owner-transfer-target',mode:'retain_admin',
      role:'role:owner-transfer-test-admin',roleVersion:1,ownershipVersion:source.version,transferVersion:1,
      targetVersion:staleTargetVersion,reasonHash:null });
    await expectOwnerTransferRejection(database,`select access.commit_owner_transfer('owner-transfer:accepted','principal:owner-transfer-target',
      'session:owner-transfer-target-accept','owner-proof:00000000-0000-4000-8000-000000000106',1,$1,$2)`,
    [source.version,staleTargetVersion],'OWNER_TRANSFER_TARGET_INVALID','membership:owner-transfer-target','principal:owner-transfer-target');

    await database.exec(`update access.role set version=2 where id='role:owner-transfer-test-admin'`);
    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000107',action:'accept',actor:'principal:owner-transfer-target',
      session:'session:owner-transfer-target-accept',source:source.membership,target:'membership:owner-transfer-target',mode:'retain_admin',
      role:'role:owner-transfer-test-admin',roleVersion:1,ownershipVersion:source.version,transferVersion:1,
      targetVersion:targetVersionForAccept,reasonHash:null });
    await expectOwnerTransferRejection(database,`select access.commit_owner_transfer('owner-transfer:accepted','principal:owner-transfer-target',
      'session:owner-transfer-target-accept','owner-proof:00000000-0000-4000-8000-000000000107',1,$1,$2)`,
    [source.version,targetVersionForAccept],'VERSION_CONFLICT','membership:owner-transfer-target','principal:owner-transfer-target');
    await database.exec(`update access.role set version=1 where id='role:owner-transfer-test-admin';
      insert into access.membershipoverride(membership_id,permission_id,effect,granted_by,reason,effective_at)
      select membership,id,'allow','contract','cleanup',clock_timestamp() from (values
        ('${source.membership}'),('membership:owner-transfer-target')) fixture(membership)
      cross join access.permission where code='access.center.read'
      on conflict(membership_id,permission_id) do update set effect='allow',granted_by='contract',
        reason='cleanup',effective_at=clock_timestamp(),expires_at=null,revoked_at=null;`);

    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000006',action:'accept',actor:'principal:owner-transfer-target',
      session:'session:owner-transfer-target-accept',source:source.membership,target:'membership:owner-transfer-target',mode:'retain_admin',
      role:'role:owner-transfer-test-admin',roleVersion:1,ownershipVersion:source.version,transferVersion:1,
      targetVersion:targetVersionForAccept,reasonHash:null });
    await expectOwnerTransferRejection(database,`select access.commit_owner_transfer('owner-transfer:accepted','principal:wrong',
      'session:owner-transfer-target','owner-proof:00000000-0000-4000-8000-000000000006',1,$1,$2)`,
    [source.version,targetVersionForAccept],'ACTION_PROOF_INVALID','membership:owner-transfer-target','principal:wrong');
    await callOwnerTransfer(database,'membership:owner-transfer-target','principal:owner-transfer-target',
      `select access.commit_owner_transfer('owner-transfer:accepted','principal:owner-transfer-target',
        'session:owner-transfer-target-accept','owner-proof:00000000-0000-4000-8000-000000000006',1,$1,$2) transfer`,
    [source.version,targetVersionForAccept]);
    const accepted=await database.query(`select owner.membership_id owner,owner.version::integer version,
      (select count(*)::integer from access.membershiprole role where role.role_id='role-platform-owner-v2'
        and role.effective_at<=clock_timestamp() and role.expires_at is null) owner_count,
      (select jsonb_agg(jsonb_build_object('membership',role.membership_id,'effective',role.effective_at,
        'expires',role.expires_at) order by role.membership_id,role.effective_at)
        from access.membershiprole role where role.role_id='role-platform-owner-v2') owner_rows,
      (select array_agg(role_id order by role_id) from access.membershiprole where membership_id='membership:owner-transfer-target'
        and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp())) target_roles,
      (select array_agg(role_id order by role_id) from access.membershiprole where membership_id=$1
        and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp())) source_roles,
      not exists(select 1 from access.membershipoverride where membership_id in($1,'membership:owner-transfer-target')
        and revoked_at is null) overrides_cleared,
      not exists(select binding.operation_id from capability.operation binding where binding.audience='operator'
        except select operation_id from capability.membership_operations('membership:owner-transfer-target')) full_operator,
      (select access_version::integer from access.membership where id=$1) source_version,
      (select access_version::integer from access.membership where id='membership:owner-transfer-target') target_version,
      (select revoked_reason from identity.session where id='session:owner-transfer-source') source_revoked_reason,
      (select revoked_reason from identity.session where id='session:owner-transfer-target-accept') target_revoked_reason
      from access.platformowner owner where owner.singleton=true`,[source.membership]);
    const acceptedRow=accepted.rows[0];
    if (!acceptedRow || acceptedRow.owner!=='membership:owner-transfer-target' || acceptedRow.owner_count!==1
      || JSON.stringify(acceptedRow.target_roles)!==JSON.stringify(['role-platform-owner-v2','role:self'])
      || JSON.stringify(acceptedRow.source_roles)!==JSON.stringify(['role:owner-transfer-test-admin','role:self'])
      || acceptedRow.source_version!==Number(source.access_version)+1 || acceptedRow.target_version!==targetVersionForAccept+1
      || acceptedRow.source_revoked_reason!=='owner_transferred' || acceptedRow.target_revoked_reason!=='owner_acquired'
      || !acceptedRow.overrides_cleared || !acceptedRow.full_operator) {
      throw new Error(`PLATFORM_OWNER_TRANSFER_ACCEPT_INVALID:${JSON.stringify(acceptedRow??null)}`);
    }
    await expectOwnerTransferRejection(database,`select access.commit_owner_transfer('owner-transfer:accepted',
      'principal:owner-transfer-target','session:owner-transfer-target-accept','owner-proof:00000000-0000-4000-8000-000000000006',1,$1,$2)`,
    [source.version,targetVersionForAccept],'VERSION_CONFLICT','membership:owner-transfer-target','principal:owner-transfer-target');

    await expectOwnerInvariantRejection(database,`update access.membershiprole set expires_at=clock_timestamp()+interval '1 day'
      where membership_id='membership:owner-transfer-target' and role_id='role-platform-owner-v2' and expires_at is null`);
    await expectOwnerInvariantRejection(database,`update access.scopegrant set expires_at=clock_timestamp()+interval '1 day'
      where membership_id='membership:owner-transfer-target' and scope_kind='platform' and expires_at is null`);

    const removeSourceVersion=acceptedRow.target_version;
    const removeTargetVersion=Number((await database.query(`select access_version from access.membership
      where id='membership:owner-transfer-expiry'`)).rows[0]?.access_version);
    await database.query(`insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,
      ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at) values
      ('session:owner-transfer-remove-source','principal:owner-transfer-target','membership:owner-transfer-target',$1,1,$2,
        'operator',$3,'contract','remove-source',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp()),
      ('session:owner-transfer-remove-target-before','principal:owner-transfer-expiry','membership:owner-transfer-expiry',$4,1,$5,
        'operator',$6,'contract','remove-target-before',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp())`,
    ['b'.repeat(64),removeSourceVersion,'c'.repeat(64),'d'.repeat(64),removeTargetVersion,'e'.repeat(64)]);
    await database.query(`insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
      values('assurance:owner-transfer-remove-source-l3','principal:owner-transfer-target','otp',3,$1,
        clock_timestamp(),clock_timestamp()+interval '15 minutes')`,
    [createHash('sha256').update('session:owner-transfer-remove-source').digest('hex')]);
    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000108',action:'create',actor:'principal:owner-transfer-target',
      session:'session:owner-transfer-remove-source',source:'membership:owner-transfer-target',target:'membership:owner-transfer-expiry',mode:'remove_admin',
      role:null,roleVersion:null,ownershipVersion:acceptedRow.version,transferVersion:null,targetVersion:removeTargetVersion,reasonHash:null });
    await callOwnerTransfer(database,'membership:owner-transfer-target','principal:owner-transfer-target',`select access.create_owner_transfer(
      'owner-transfer:remove-admin','principal:owner-transfer-target','session:owner-transfer-remove-source',
      'owner-proof:00000000-0000-4000-8000-000000000108',$1,$2)`,[acceptedRow.version,removeTargetVersion]);
    const removeRequested=await database.query(`select transfer.state,
      (select access_version::integer from access.membership where id='membership:owner-transfer-target') source_version,
      (select access_version::integer from access.membership where id='membership:owner-transfer-expiry') target_version,
      (select revoked_reason from identity.session where id='session:owner-transfer-remove-target-before') target_revoked_reason
      from access.ownertransfer transfer where transfer.id='owner-transfer:remove-admin'`);
    const removeRequestedRow=removeRequested.rows[0];
    if (!removeRequestedRow || removeRequestedRow.state!=='pending_acceptance'
      || removeRequestedRow.source_version!==removeSourceVersion || removeRequestedRow.target_version!==removeTargetVersion+1
      || removeRequestedRow.target_revoked_reason!=='owner_transfer_requested') {
      throw new Error(`PLATFORM_OWNER_TRANSFER_REMOVE_REQUEST_INVALID:${JSON.stringify(removeRequestedRow??null)}`);
    }
    await database.exec(`update access.ownertransfer set requested_at=statement_timestamp()-interval '25 hours',
      cooling_until=statement_timestamp()-interval '1 hour',expires_at=statement_timestamp()+interval '143 hours'
      where id='owner-transfer:remove-admin'`);
    const removeTargetVersionForAccept=removeRequestedRow.target_version;
    await database.query(`insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,
      ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
      values('session:owner-transfer-remove-target-accept','principal:owner-transfer-expiry','membership:owner-transfer-expiry',$1,1,$2,
        'operator',$3,'contract','remove-target-accept',3,clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp())`,
    ['f'.repeat(64),removeTargetVersionForAccept,'0'.repeat(64)]);
    await database.query(`insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
      values('assurance:owner-transfer-remove-target-l3','principal:owner-transfer-expiry','otp',3,$1,
        clock_timestamp(),clock_timestamp()+interval '15 minutes')`,
    [createHash('sha256').update('session:owner-transfer-remove-target-accept').digest('hex')]);
    await insertOwnerProof(database,{ nonce:'owner-proof:00000000-0000-4000-8000-000000000109',action:'accept',actor:'principal:owner-transfer-expiry',
      session:'session:owner-transfer-remove-target-accept',source:'membership:owner-transfer-target',target:'membership:owner-transfer-expiry',
      mode:'remove_admin',role:null,roleVersion:null,ownershipVersion:acceptedRow.version,transferVersion:1,
      targetVersion:removeTargetVersionForAccept,reasonHash:null });
    await callOwnerTransfer(database,'membership:owner-transfer-expiry','principal:owner-transfer-expiry',
      `select access.commit_owner_transfer('owner-transfer:remove-admin','principal:owner-transfer-expiry',
        'session:owner-transfer-remove-target-accept','owner-proof:00000000-0000-4000-8000-000000000109',1,$1,$2)`,
    [acceptedRow.version,removeTargetVersionForAccept]);
    const removed=await database.query(`select owner.membership_id owner,owner.version::integer version,
      (select count(*)::integer from access.membershiprole role where role.role_id='role-platform-owner-v2'
        and role.effective_at<=clock_timestamp() and role.expires_at is null) owner_count,
      (select status from access.membership where id='membership:owner-transfer-target') source_status,
      (select access_version::integer from access.membership where id='membership:owner-transfer-target') source_version,
      (select array_agg(role_id order by role_id) from access.membershiprole where membership_id='membership:owner-transfer-target'
        and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp())) source_roles,
      (select array_agg(scope_kind order by scope_kind) from access.scopegrant where membership_id='membership:owner-transfer-target'
        and effect='allow' and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp())) source_scopes,
      (select access_version::integer from access.membership where id='membership:owner-transfer-expiry') target_version,
      (select array_agg(role_id order by role_id) from access.membershiprole where membership_id='membership:owner-transfer-expiry'
        and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp())) target_roles,
      (select array_agg(scope_kind order by scope_kind) from access.scopegrant where membership_id='membership:owner-transfer-expiry'
        and effect='allow' and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp())) target_scopes,
      (select jsonb_build_object('status',status,'version',access_version) from access.membership
        where id='membership:owner-transfer-target-storefront') storefront,
      (select revoked_reason from identity.session where id='session:owner-transfer-remove-source') source_revoked_reason,
      (select revoked_reason from identity.session where id='session:owner-transfer-remove-target-accept') target_revoked_reason,
      not exists(select binding.operation_id from capability.operation binding where binding.audience='operator'
        except select operation_id from capability.membership_operations('membership:owner-transfer-expiry')) full_operator
      from access.platformowner owner where owner.singleton=true`);
    const removedRow=removed.rows[0];
    if (!removedRow || removedRow.owner!=='membership:owner-transfer-expiry' || removedRow.version!==acceptedRow.version+1
      || removedRow.owner_count!==1 || removedRow.source_status!=='suspended'
      || removedRow.source_version!==removeSourceVersion+1 || removedRow.target_version!==removeTargetVersionForAccept+1
      || JSON.stringify(removedRow.source_roles)!==JSON.stringify(['role:self'])
      || JSON.stringify(removedRow.source_scopes)!==JSON.stringify(['self'])
      || JSON.stringify(removedRow.target_roles)!==JSON.stringify(['role-platform-owner-v2','role:self'])
      || JSON.stringify(removedRow.target_scopes)!==JSON.stringify(['platform','self','tenant'])
      || JSON.stringify(removedRow.storefront)!==JSON.stringify({status:'active',version:4})
      || removedRow.source_revoked_reason!=='owner_transferred' || removedRow.target_revoked_reason!=='owner_acquired'
      || !removedRow.full_operator) {
      throw new Error(`PLATFORM_OWNER_TRANSFER_REMOVE_ACCEPT_INVALID:${JSON.stringify(removedRow??null)}`);
    }

    await expectOwnerInvariantRejection(database,`update access.platformowner
      set membership_id='membership:owner-transfer-target' where singleton=true`);
    await expectOwnerInvariantRejection(database,`update access.membershiprole set expires_at=clock_timestamp()+interval '1 day'
      where membership_id='membership:owner-transfer-expiry' and role_id='role-platform-owner-v2' and expires_at is null`);
    await expectOwnerInvariantRejection(database,`update access.scopegrant set expires_at=clock_timestamp()+interval '1 day'
      where membership_id='membership:owner-transfer-expiry' and scope_kind='platform' and expires_at is null`);
    await expectOwnerInvariantRejection(database,`update member.profile set status='disabled'
      where id='member:owner-transfer-expiry'`);
    await expectOwnerInvariantRejection(database,`update identity.principal set status='disabled'
      where id='principal:owner-transfer-expiry'`);
    await expectOwnerInvariantRejection(database,`insert into access.membershiprole(
      membership_id,role_id,effective_at,delegated_by) values(
      'membership:owner-transfer-target','role-platform-owner-v2',clock_timestamp()+interval '1 day',
      'principal:owner-transfer-expiry')`);
    await expectOwnerInvariantRejection(database,`insert into access.membershipoverride(
      membership_id,permission_id,effect,granted_by,reason,effective_at)
      select 'membership:owner-transfer-expiry',id,'deny','principal:owner-transfer-expiry',
        'future deny invariant',clock_timestamp()+interval '1 day'
      from access.permission where code='access.center.read'`);
    await expectOwnerInvariantRejection(database,`update access.platformowner set state='bootstrap_pending',
      membership_id=null,initialized_at=null where singleton=true`);

    await database.exec(`set local role zhudatuanidentityapi;
      select set_config('app.workload','api',true),set_config('app.membership_id','membership:owner-transfer-expiry',true),
        set_config('app.actor_id','principal:owner-transfer-expiry',true),set_config('app.scope_id','tenant-zhudatuan',true);`);
    const newInvitationOwner=await database.query(`select access.zhudatuan_invitation_owner() allowed`);
    await database.exec(`select set_config('app.membership_id','membership:owner-transfer-target',true),
      set_config('app.actor_id','principal:owner-transfer-target',true);`);
    const formerInvitationOwner=await database.query(`select access.zhudatuan_invitation_owner() allowed`);
    await database.exec(`select set_config('app.membership_id',$$${source.membership}$$,true),
      set_config('app.actor_id',$$${source.principal}$$,true);`);
    const originalInvitationOwner=await database.query(`select access.zhudatuan_invitation_owner() allowed`);
    if (newInvitationOwner.rows[0]?.allowed!==true || formerInvitationOwner.rows[0]?.allowed!==false
      || originalInvitationOwner.rows[0]?.allowed!==false) {
      throw new Error(`PLATFORM_OWNER_INVITATION_CUTOVER_INVALID:${JSON.stringify({
        new:newInvitationOwner.rows[0],former:formerInvitationOwner.rows[0],original:originalInvitationOwner.rows[0]})}`);
    }
    if (mode==='--owner-transfer') {
      await database.exec('reset role; set local session authorization zhudatuanbootstrap;');
      const bootstrapState=await database.query(`select * from deployment.zhudatuan_owner_bootstrap_state($1)`,
        ['registration-fresh-replay-sentinel-not-for-production']);
      if (JSON.stringify(bootstrapState.rows[0])!==JSON.stringify({
        state:'active',active_owner_count:1,principal_id:'principal:owner-transfer-expiry',
        membership_id:'membership:owner-transfer-expiry',current_owner_valid:true,fixed_identity_collision:false,
      })) throw new Error(`PLATFORM_OWNER_DYNAMIC_BOOTSTRAP_STATE_INVALID:${JSON.stringify(bootstrapState.rows[0]??null)}`);
    }
  } finally {
    await database.exec('rollback');
  }
}

async function verifyPlatformOwnerMigrationNormalization(database) {
  const normalized=await database.query(`with owner as (
      select owner.membership_id,membership.access_version,profile.principal_id
      from access.platformowner owner
      join access.membership membership on membership.id=owner.membership_id
      join member.profile profile on profile.id=membership.member_id
      where owner.singleton=true and owner.state='active'
    ) select
      (select membership_id from owner) owner,
      (select count(*)::integer from access.membershiprole assignment
        where assignment.role_id='role-platform-owner-v2'
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) owner_assignments,
      (select array_agg(assignment.role_id order by assignment.role_id)
        from access.membershiprole assignment cross join owner
        where assignment.membership_id=owner.membership_id
          and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) active_roles,
      (select count(*)::integer from access.membershipoverride overridepermission cross join owner
        where overridepermission.membership_id=owner.membership_id
          and overridepermission.revoked_at is null
          and overridepermission.effective_at<=clock_timestamp()
          and (overridepermission.expires_at is null or overridepermission.expires_at>clock_timestamp())) active_overrides,
      (select count(*)::integer from access.scopegrant grantrow cross join owner
        where grantrow.membership_id=owner.membership_id
          and grantrow.effective_at<=clock_timestamp()
          and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp())) active_scopes,
      (select count(*)::integer from access.scopegrant grantrow cross join owner
        where grantrow.membership_id=owner.membership_id and grantrow.scope_kind='self'
          and grantrow.scope_id='self:'||owner.principal_id
          and grantrow.scope_path='self:'||owner.principal_id and grantrow.effect='allow'
          and grantrow.effective_at<=clock_timestamp() and grantrow.expires_at is null
          and grantrow.access_version>0 and grantrow.access_version<=owner.access_version) correct_self_scopes,
      (select count(*)::integer from access.scopegrant grantrow cross join owner
        where grantrow.membership_id=owner.membership_id
          and grantrow.effective_at<=clock_timestamp()
          and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp())
          and not (grantrow.effect='allow' and grantrow.expires_at is null
            and grantrow.access_version>0 and grantrow.access_version<=owner.access_version and (
              (grantrow.scope_kind='platform' and grantrow.scope_id='organization-platform-root'
                and grantrow.scope_path='organization-platform-root')
              or (grantrow.scope_kind='tenant' and grantrow.scope_id='tenant-zhudatuan'
                and grantrow.scope_path='tenant-zhudatuan')
              or (grantrow.scope_kind='self' and grantrow.scope_id='self:'||owner.principal_id
                and grantrow.scope_path='self:'||owner.principal_id)))) invalid_active_scopes,
      not exists(select binding.operation_id from capability.operation binding where binding.audience='operator'
        except select operations.operation_id from owner
          cross join lateral capability.membership_operations(owner.membership_id) operations) full_operator,
      not exists(select operation.id from runtime.operation operation where operation.id like 'access.ownership.%'
        except select operations.operation_id from owner
          cross join lateral capability.membership_operations(owner.membership_id) operations) full_ownership,
      coalesce((select bool_or((grantrow->'permissions')?'access.ownership.read')
        from owner cross join lateral access.resolve_membership(owner.membership_id) resolved
        cross join lateral jsonb_array_elements(resolved.grants) grantrow
        where grantrow->'scope'->>'id'=owner.principal_id),false) ownership_read,
      coalesce((select bool_or((grantrow->'permissions')?'access.ownership.transfer')
        from owner cross join lateral access.resolve_membership(owner.membership_id) resolved
        cross join lateral jsonb_array_elements(resolved.grants) grantrow
        where grantrow->'scope'->>'id'=owner.principal_id),false) ownership_transfer,
      coalesce((select bool_or((grantrow->'permissions')?'access.ownership.accept')
        from owner cross join lateral access.resolve_membership(owner.membership_id) resolved
        cross join lateral jsonb_array_elements(resolved.grants) grantrow
        where grantrow->'scope'->>'id'=owner.principal_id),false) ownership_accept,
      coalesce((select bool_or((grantrow->'permissions')?'channel.distributor.manage')
        from owner cross join lateral access.resolve_membership(owner.membership_id) resolved
        cross join lateral jsonb_array_elements(resolved.grants) grantrow
        where grantrow->'scope'->>'id'='organization-platform-root'),false) distributor_manage_platform,
      coalesce((select bool_or((grantrow->'permissions')?'extension.installation.read')
        from owner cross join lateral access.resolve_membership(owner.membership_id) resolved
        cross join lateral jsonb_array_elements(resolved.grants) grantrow
        where grantrow->'scope'->>'id'='organization-platform-root'),false) extension_read_platform,
      (select scope->>'id' from owner cross join lateral access.resolve_scope(owner.membership_id,
        'channel.distributors.create',null) resolved) distributor_scope,
      (select scope->>'id' from owner cross join lateral access.resolve_scope(owner.membership_id,
        'extension.installations.read',null) resolved) extension_scope,
      not exists(select 1 from owner cross join lateral access.resolve_membership(owner.membership_id) resolved
        where 'identity.invitation.manage'=any(resolved.denies)) expired_role_deny_cleared,
      exists(select 1 from identity.challenge where id='challenge:owner-transfer-precutover-stepup'
        and consumed_at is not null) old_stepup_challenge_invalidated,
      exists(select 1 from identity.assurance where id='assurance:owner-transfer-precutover-stepup'
        and expires_at<=clock_timestamp()) old_stepup_assurance_invalidated,
      exists(select 1 from identity.session where id='session:owner-transfer-precutover-stepup'
        and revoked_at is not null and revoked_reason='owner_stepup_boundary_rotated') old_stepup_session_invalidated`);
  const row=normalized.rows[0];
  if (!row || row.owner===null || row.owner_assignments!==1
    || JSON.stringify(row.active_roles)!==JSON.stringify(['role-platform-owner-v2','role:self'])
    || row.active_overrides!==0 || row.active_scopes!==3 || row.correct_self_scopes!==1
    || row.invalid_active_scopes!==0 || !row.full_operator || !row.full_ownership
    || !row.ownership_read || !row.ownership_transfer || !row.ownership_accept
    || !row.distributor_manage_platform || !row.extension_read_platform
    || row.distributor_scope!=='organization-platform-root' || row.extension_scope!=='organization-platform-root'
    || !row.expired_role_deny_cleared || !row.old_stepup_challenge_invalidated
    || !row.old_stepup_assurance_invalidated || !row.old_stepup_session_invalidated) {
    throw new Error(`PLATFORM_OWNER_MIGRATION_NORMALIZATION_INVALID:${JSON.stringify(row??null)}`);
  }
}

async function insertOwnerProof(database,input) {
  await database.query(`insert into access.owneractionproof(nonce,action,actor_id,session_id,source_membership_id,
    target_membership_id,former_owner_mode,former_owner_role_id,former_owner_role_version,ownership_version,
    transfer_version,target_access_version,reason_hash,expires_at,created_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,clock_timestamp()+interval '5 minutes',clock_timestamp())`,
  [input.nonce,input.action,input.actor,input.session,input.source,input.target,input.mode,input.role,input.roleVersion,
    input.ownershipVersion,input.transferVersion,input.targetVersion,input.reasonHash]);
}

async function verifyOperatorRegistrationSubjectBoundary(database,ownerMembership) {
  const subjectHash='a'.repeat(64);
  const mobileToken='b'.repeat(64);
  const wrongSubjectHash='c'.repeat(64);
  const seed=async (suffix,credentialSubject) => {
    await database.exec(`savepoint operator_registration_subject_boundary;
      insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
      values('principal:operator-registration-${suffix}','active',1,clock_timestamp(),clock_timestamp(),0);
      insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at)
      values('credential:operator-registration-${suffix}','principal:operator-registration-${suffix}','password',
        '${credentialSubject}','contract-registration-secret','active',clock_timestamp());
      insert into member.profile(id,principal_id,display_name,mobile_ciphertext,mobile_token,mobile_masked,
        status,created_at,updated_at,version)
      values('member:operator-registration-${suffix}','principal:operator-registration-${suffix}',
        'Operator Registration ${suffix}','kms:operator-registration-${suffix}','${mobileToken}','138****0000',
        'active',clock_timestamp(),clock_timestamp(),0);
      insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,accepted_at,
        created_by,role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,
        registration_policy_id,terms_hash,version,target_client,storefront_organization_id)
      select 'invite:operator-registration-${suffix}','tenant-zhudatuan','Operator ${suffix}','${subjectHash}',
        encode(public.digest('invite:operator-registration-${suffix}','sha256'),'hex'),
        clock_timestamp()+interval '1 day',clock_timestamp(),'${ownerMembership}',
        'role-zhudatuan-pending-operator','${subjectHash}',1,1,'1970-01-01T00:00:00Z','active',
        clock_timestamp(),policy.id,policy.terms_hash,1,'operator','mall-zhudatuan'
      from identity.registrationpolicy policy where policy.effective_at<=clock_timestamp()
        and (policy.retired_at is null or policy.retired_at>clock_timestamp())
      order by policy.version desc limit 1;
      insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,attempts,
        expires_at,consumed_at,created_at)
      values('challenge:operator-registration-${suffix}',null,'registration','${subjectHash}',
        'contract-code',1,clock_timestamp()+interval '10 minutes',clock_timestamp(),clock_timestamp());
      set local role zhudatuanidentityapi;`);
  };

  await seed('wrong-subject',wrongSubjectHash);
  let rejected=false;
  try {
    await database.exec(`insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
      values('membership:operator-registration-wrong-subject','member:operator-registration-wrong-subject',
        'tenant-zhudatuan','operator','active',1,clock_timestamp())`);
  } catch(error) {
    rejected=String(error instanceof Error?error.message:error)
      .includes('ZHUDATUAN_REGISTRATION_MEMBERSHIP_BOUNDARY_INVALID');
  }
  await database.exec('rollback to savepoint operator_registration_subject_boundary; reset role');
  if (!rejected) throw new Error('OPERATOR_REGISTRATION_WRONG_SUBJECT_ACCEPTED');

  await seed('canonical-subject',subjectHash);
  await database.exec(`insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values('membership:operator-registration-canonical-subject','member:operator-registration-canonical-subject',
      'tenant-zhudatuan','operator','active',1,clock_timestamp());
    insert into access.membershiprole(membership_id,role_id,effective_at) values
      ('membership:operator-registration-canonical-subject','role:self',clock_timestamp()),
      ('membership:operator-registration-canonical-subject','role-zhudatuan-pending-operator',clock_timestamp());
    insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version) values
      ('scope:operator-registration-canonical-subject:tenant','membership:operator-registration-canonical-subject',
        'tenant','tenant-zhudatuan','tenant-zhudatuan','allow',clock_timestamp(),1),
      ('scope:operator-registration-canonical-subject:self','membership:operator-registration-canonical-subject',
        'self','self:principal:operator-registration-canonical-subject',
        'self:principal:operator-registration-canonical-subject','allow',clock_timestamp(),1);`);
  const evidence=await database.query(`select
      credential.subject_hash<>profile.mobile_token distinct_hashes,
      invite.allowed_destination_hash=credential.subject_hash invite_bound,
      challenge.destination_hash=credential.subject_hash challenge_bound,
      (select count(*)::integer from access.membershiprole
        where membership_id='membership:operator-registration-canonical-subject') role_count,
      (select count(*)::integer from access.scopegrant
        where membership_id='membership:operator-registration-canonical-subject') scope_count
    from identity.credential credential
    join member.profile profile on profile.principal_id=credential.principal_id
    join member.invite invite on invite.id='invite:operator-registration-canonical-subject'
    join identity.challenge challenge on challenge.id='challenge:operator-registration-canonical-subject'
    where credential.id='credential:operator-registration-canonical-subject'`);
  await database.exec('rollback to savepoint operator_registration_subject_boundary; reset role');
  if (JSON.stringify(evidence.rows[0])!==JSON.stringify({
    distinct_hashes:true,invite_bound:true,challenge_bound:true,role_count:2,scope_count:2,
  })) throw new Error(`OPERATOR_REGISTRATION_CANONICAL_SUBJECT_INVALID:${JSON.stringify(evidence.rows[0]??null)}`);
}

async function callOwnerTransfer(database,membership,actor,sql,parameters) {
  await database.exec(`set local role shopapp;
    select set_config('app.workload','api',true),set_config('app.membership_id',$$${membership}$$,true),
      set_config('app.actor_id',$$${actor}$$,true),set_config('app.scope_id','self:'||$$${actor}$$,true);`);
  const result=await database.query(sql,parameters);
  await database.exec('reset role');
  return result;
}

async function expectOwnerTransferRejection(database,sql,parameters,code,membership,actor) {
  await database.exec('savepoint owner_transfer_rejection');
  let rejected=false;
  try { await callOwnerTransfer(database,membership,actor,sql,parameters); }
  catch(error) { rejected=String(error instanceof Error?error.message:error).includes(code); }
  await database.exec('rollback to savepoint owner_transfer_rejection; reset role');
  if (!rejected) throw new Error(`PLATFORM_OWNER_TRANSFER_REJECTION_MISSING:${code}`);
}

async function expectOwnerAclRejection(database,sql) {
  await database.exec(`begin; set local role shopapp;
    select set_config('app.workload','api',true),set_config('app.membership_id','membership:acl-spoof',true),
      set_config('app.actor_id','principal:acl-spoof',true),set_config('app.scope_id','self:principal:acl-spoof',true);`);
  let rejected=false;
  try { await database.exec(sql); }
  catch(error) {
    const message=String(error instanceof Error?error.message:error);
    rejected=message.includes('permission denied') || message.includes('row-level security');
  }
  await database.exec('rollback');
  if (!rejected) throw new Error(`PLATFORM_OWNER_DIRECT_ACL_MUTATION_ALLOWED:${sql.split(/\s+/).slice(0,4).join(' ')}`);
}

async function expectOwnerBootstrapAclRejection(database,sql) {
  await database.exec('begin; set local role zhudatuanbootstrap;');
  let rejected=false;
  try { await database.exec(sql); }
  catch(error) { rejected=String(error instanceof Error?error.message:error).includes('permission denied'); }
  await database.exec('rollback');
  if (!rejected) throw new Error('PLATFORM_OWNER_BOOTSTRAP_DIRECT_READ_ALLOWED');
}

async function expectOwnerInvariantRejection(database,sql) {
  await database.exec('savepoint owner_invariant_rejection; reset role');
  let rejected=false;
  let rejectionMessage='none';
  try { await database.exec(`${sql}; set constraints all immediate;`); }
  catch(error) {
    rejectionMessage=String(error instanceof Error?error.message:error);
    rejected=['ACTIVE_PLATFORM_OWNER_NOT_UNIQUE','PLATFORM_OWNER_LIFECYCLE_PROTECTED',
      'PLATFORM_OWNER_RESOLVED_COVERAGE_DRIFT']
      .some((code)=>rejectionMessage.includes(code));
  }
  await database.exec('rollback to savepoint owner_invariant_rejection; set constraints all deferred');
  if (!rejected) throw new Error(`PLATFORM_OWNER_PERMANENCE_REJECTION_MISSING:${rejectionMessage}`);
}

async function exerciseOwnerCoverageBoundary(database, boundaryGuard, setup, expectedCode) {
  await database.exec(`begin;${setup}`);
  let rejection;
  try {
    await database.exec(boundaryGuard);
  } catch (error) {
    rejection=error;
  } finally {
    await database.exec('rollback');
  }
  if (expectedCode===null) {
    if (rejection) throw rejection;
    return;
  }
  if (!rejection || !String(rejection instanceof Error ? rejection.message : rejection).includes(expectedCode)) {
    throw new Error(`OWNER_OPERATOR_COVERAGE_BOUNDARY_TEST_FAILED:${expectedCode}:${String(rejection??'accepted')}`);
  }
}

async function expectOwnerCoverageFailure(database, mutation, expectedCode) {
  await database.exec('begin');
  try {
    await database.exec(mutation);
    await database.exec('set constraints all immediate');
  } catch (error) {
    await database.exec('rollback');
    if (!String(error instanceof Error ? error.message : error).includes(expectedCode)) throw error;
    return;
  }
  await database.exec('rollback');
  throw new Error(`OWNER_OPERATOR_COVERAGE_NEGATIVE_TEST_FAILED:${expectedCode}`);
}

async function verifyZhudatuanBootstrapRuntimeRepair(database) {
  const canonicalOwnerRole = await database.query(`select id,scope_id,status from access.role
    where id='role-platform-owner-v2'`);
  if (JSON.stringify(canonicalOwnerRole.rows)!==JSON.stringify([{
    id:'role-platform-owner-v2',scope_id:'tenant-zhudatuan',status:'active',
  }])) throw new Error(`ZHUDATUAN_BOOTSTRAP_OWNER_ROLE_INVALID:${JSON.stringify(canonicalOwnerRole.rows)}`);
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
      has_table_privilege(current_user,'member.invite','SELECT,INSERT') invite_read_create,
      has_table_privilege(current_user,'identity.principal','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') principal_write,
      has_table_privilege(current_user,'access.membership','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') membership_write,
      has_table_privilege(current_user,'access.membershiprole','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') membership_role_write,
      has_table_privilege(current_user,'member.invite','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') invite_mutate,
      (select array_agg(id order by id) from access.role where id in(
        'role-platform-owner-v2','role-zhudatuan-storefront-member','role:self')) visible_roles,
      (select count(*)::integer from access.membershiprole assignment
        join access.membership membership on membership.id=assignment.membership_id
        where assignment.role_id='role-zhudatuan-storefront-member'
          and membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')) legacy_assignments,
      (select array_agg(membership_id order by membership_id) from access.membershiprole
        where membership_id in('membership:bootstrap-rls-legacy','membership:bootstrap-rls-canonical')) fixture_assignments,
      (select count(*)::integer from member.invite where status='active' and (
        id='invite-demo-employee-2026' or organization_id in('tenant-smart-wing','enterprise-demo','mall-demo'))) legacy_invites,
      (select count(*)::integer from identity.principal
        where id='principal:zhudatuan:owner:ethan:v1') fixed_owner_principals,
      (select count(*)::integer from access.membership
        where id='membership-platform-owner-ethan-v1'
          and organization_id='tenant-zhudatuan' and client='operator') fixed_owner_memberships`);
    const row = result.rows[0];
    if (JSON.stringify(row)!==JSON.stringify({
      principal_read:true,membership_read:true,membership_role_read:true,invite_read_create:true,
      principal_write:false,membership_write:false,membership_role_write:false,invite_mutate:false,
      visible_roles:['role-platform-owner-v2','role-zhudatuan-storefront-member','role:self'],
      legacy_assignments:1,fixture_assignments:['membership:bootstrap-rls-legacy'],legacy_invites:0,
      fixed_owner_principals:0,fixed_owner_memberships:0,
    })) {
      const policies = await database.query(`select policyname,permissive,roles,qual from pg_policies
        where schemaname='access' and tablename='role' order by policyname`);
      throw new Error(`ZHUDATUAN_BOOTSTRAP_RUNTIME_ACCESS_INVALID:${JSON.stringify({row,policies:policies.rows})}`);
    }
  } finally {
    await database.exec('rollback');
  }
  if (mode==='--registration-fresh') {
    const boundary = await database.query(`select
      has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE') bootstrap_allowed,
      has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE') definer_allowed`);
    if (JSON.stringify(boundary.rows[0])!==JSON.stringify({bootstrap_allowed:true,definer_allowed:true})) {
      throw new Error(`ZHUDATUAN_BOOTSTRAP_DEFINER_BOUNDARY_INVALID:${JSON.stringify(boundary.rows[0])}`);
    }
  }
}

async function verifySandboxMemberBootstraps(database) {
  const sentinel='registration-fresh-replay-sentinel-not-for-production';
  await database.exec(`
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values('principal:sandbox-member-bootstrap','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values('member:sandbox-member-bootstrap','principal:sandbox-member-bootstrap','Sandbox Bootstrap','active',
      clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values('membership:sandbox-member-bootstrap','member:sandbox-member-bootstrap','mall-zhudatuan','storefront','active',1,
      clock_timestamp());
    insert into access.membershiprole(membership_id,role_id,effective_at,expires_at,delegated_by)
    values('membership:sandbox-member-bootstrap','role-zhudatuan-storefront-member',clock_timestamp(),null,
      'registration-fresh-replay');
    set session authorization zhudatuansandboxbootstrap;`);
  const boundary=await database.query(`select current_database() database_name,current_user,session_user,
    deployment.sandbox_catalog_bootstrap_boundary($1) sentinel_valid,
    has_schema_privilege(current_user,'benefit','USAGE') benefit_usage,
    has_schema_privilege(current_user,'finance','USAGE') finance_usage`,[sentinel]);
  if (JSON.stringify(boundary.rows[0])!==JSON.stringify({
    database_name:'zhudatuan_registration',current_user:'zhudatuansandboxbootstrap',session_user:'zhudatuansandboxbootstrap',
    sentinel_valid:true,benefit_usage:false,finance_usage:false,
  })) throw new Error(`SANDBOX_MEMBER_BOOTSTRAP_BOUNDARY_INVALID:${JSON.stringify(boundary.rows[0])}`);
  for (let replay=0;replay<2;replay+=1) {
    const qualification=await database.query(
      'select deployment.sandbox_member_qualification_bootstrap($1,$2) result',
      [sentinel,'membership:sandbox-member-bootstrap'],
    );
    const result=qualification.rows[0]?.result;
    if (!result || result.membership!=='membership:sandbox-member-bootstrap'
      || result.member!=='member:sandbox-member-bootstrap' || result.scope!=='mall-zhudatuan'
      || result.status!=='active' || result.version!==1 || result.benefitAmountGranted!==false) {
      throw new Error(`SANDBOX_QUALIFICATION_REPLAY_INVALID:${JSON.stringify(result??null)}`);
    }
  }
  for (let replay=0;replay<2;replay+=1) {
    const welfare=await database.query(
      'select deployment.sandbox_member_welfare_bootstrap($1,$2,$3,$4,$5) result',
      [sentinel,'membership:sandbox-member-bootstrap',500,'CNY','OWNER_APPROVES_ONE_EXPLICIT_SANDBOX_WELFARE_GRANT'],
    );
    const result=welfare.rows[0]?.result;
    if (!result || result.membership!=='membership:sandbox-member-bootstrap'
      || result.member!=='member:sandbox-member-bootstrap' || result.scope!=='mall-zhudatuan'
      || result.amountMinor!==500 || result.currency!=='CNY' || result.expiresInDays!==30
      || result.sandboxOnly!==true || typeof result.account!=='string' || typeof result.batch!=='string') {
      throw new Error(`SANDBOX_WELFARE_REPLAY_INVALID:${JSON.stringify(result??null)}`);
    }
  }
  let conflict=false;
  try {
    await database.query('select deployment.sandbox_member_welfare_bootstrap($1,$2,$3,$4,$5)',
      [sentinel,'membership:sandbox-member-bootstrap',501,'CNY','OWNER_APPROVES_ONE_EXPLICIT_SANDBOX_WELFARE_GRANT']);
  } catch (error) {
    conflict=String(error instanceof Error?error.message:error).includes('SANDBOX_WELFARE_AMOUNT_CONFLICT');
  }
  if (!conflict) throw new Error('SANDBOX_WELFARE_DIFFERENT_AMOUNT_NOT_REJECTED');
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
    const scopes=await database.query(`select
      access.purchase_member_allowed('member:purchase-rls') member_allowed,
      access.purchase_mall_allowed('mall-zhudatuan') mall_allowed,
      access.purchase_risk_scope_allowed('tenant-zhudatuan') ancestor_allowed,
      access.purchase_risk_scope_allowed('scope:purchase-unrelated') unrelated_allowed,
      has_schema_privilege(current_user,'finance','USAGE') finance_usage,
      has_schema_privilege(current_user,'voucher','USAGE') voucher_usage`);
    if (JSON.stringify(scopes.rows[0])!==JSON.stringify({
      member_allowed:true,mall_allowed:true,ancestor_allowed:true,unrelated_allowed:false,
      finance_usage:false,voucher_usage:false,
    })) throw new Error(`ZHUDATUAN_PURCHASE_SCOPE_INVALID:${JSON.stringify(scopes.rows[0])}`);
    const visible=await database.query("select array_agg(id order by id) ids from risk.policy where id like 'risk:purchase-%'");
    if (JSON.stringify(visible.rows[0]?.ids)!==JSON.stringify(['risk:purchase-ancestor'])) {
      throw new Error(`ZHUDATUAN_PURCHASE_RISK_RLS_INVALID:${JSON.stringify(visible.rows[0])}`);
    }
    for (const expression of [
      "access.purchase_member_scope('membership:purchase-rls','session:purchase-rls')",
      "benefit.purchase_available('membership:purchase-rls','session:purchase-rls',array['benefit:none']::text[])",
      "benefit.purchase_reserve('membership:purchase-rls','session:purchase-rls','order:guard','member:purchase-rls',array['benefit:none']::text[],array[1]::bigint[])",
    ]) {
      await database.exec('savepoint direct_purchase_session_guard');
      let rejected=false;
      try { await database.query(`select * from ${expression}`); }
      catch (error) { rejected=String(error instanceof Error?error.message:error).includes('PURCHASE_SESSION_INVALID'); }
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
    const scopes=await database.query(`select
      access.web_scope_allowed('tenant-zhudatuan') business_ancestor,
      access.web_risk_scope_allowed('member:web-business-rls') risk_member,
      access.web_risk_scope_allowed('mall-zhudatuan') risk_mall,
      access.web_risk_scope_allowed('tenant-zhudatuan') risk_ancestor,
      access.web_risk_scope_allowed('scope:web-business-unrelated') risk_unrelated`);
    if (JSON.stringify(scopes.rows[0])!==JSON.stringify({
      business_ancestor:false,risk_member:true,risk_mall:true,risk_ancestor:true,risk_unrelated:false,
    })) {
      throw new Error(`ZHUDATUAN_WEB_RISK_SCOPE_INVALID:${JSON.stringify(scopes.rows[0])}`);
    }
    const visible=await database.query("select array_agg(id order by id) ids from risk.policy where id like 'risk:web-business-%'");
    if (JSON.stringify(visible.rows[0]?.ids)!==JSON.stringify(['risk:web-business-ancestor'])) {
      throw new Error(`ZHUDATUAN_WEB_RISK_RLS_INVALID:${JSON.stringify(visible.rows[0])}`);
    }
    const decisions=await database.query("select array_agg(id order by id) ids from access.decisionaudit where id like 'decision:web-business-%'");
    if (JSON.stringify(decisions.rows[0]?.ids)!==JSON.stringify([
      'decision:web-business-ancestor','decision:web-business-member',
    ])) {
      throw new Error(`ZHUDATUAN_WEB_DECISION_VELOCITY_RLS_INVALID:${JSON.stringify(decisions.rows[0])}`);
    }
    for (const expression of [
      "access.web_member_scope('membership:web-business-rls','session:web-business-rls')",
      "access.web_storefront_scope('membership:web-business-rls','session:web-business-rls')",
      "benefit.web_account_balance('membership:web-business-rls','session:web-business-rls')",
    ]) {
      await database.exec('savepoint direct_session_guard');
      let rejected=false;
      try { await database.query(`select * from ${expression}`); }
      catch (error) { rejected=String(error instanceof Error?error.message:error).includes('WEB_'); }
      await database.exec('rollback to savepoint direct_session_guard');
      if (!rejected) throw new Error(`ZHUDATUAN_WEB_SET_ROLE_HELPER_ALLOWED:${expression}`);
    }
  } finally {
    await database.exec('rollback');
  }
}

async function verifySandboxCatalogBootstrap(database) {
  const sql = await readFile(SANDBOX_CATALOG,'utf8');
  await database.exec(`begin; set local role zhudatuansandboxbootstrap;
    select pg_advisory_xact_lock(hashtext('zhudatuan:sandbox-catalog:v1'));
    select pg_advisory_xact_lock(hashtextextended('audit:mall-zhudatuan',0));`);
  try {
    await execute(database,sql,'sandbox catalog first replay');
    await execute(database,sql,'sandbox catalog idempotent replay');
    const result=await database.query(`select
      (select count(*)::integer from experience.application where id='application:zhudatuan:sandbox:v1') applications,
      (select count(*)::integer from experience.release where id='release:zhudatuan:sandbox:v1' and state='active') releases,
      (select count(*)::integer from experience.publication where id='publication:zhudatuan:sandbox:v1' and state='active') publications,
      (select count(*)::integer from catalog.product where id='product:zhudatuan:sandbox:welcome') products,
      (select count(*)::integer from catalog.sku where id='sku:zhudatuan:sandbox:welcome') skus,
      (select count(*)::integer from catalog.listing where id='listing:zhudatuan:sandbox:welcome') listings,
      (select count(*)::integer from pricing.price where id='price:zhudatuan:sandbox:welcome') prices,
      (select count(*)::integer from inventory.stockitem where id='stock:zhudatuan:sandbox:welcome') stocks,
      (select count(*)::integer from audit.record
        where id in('audit:zhudatuan:sandbox-catalog:v1','audit:zhudatuan:sandbox-publication:v1')) audits`);
    if (JSON.stringify(result.rows[0])!==JSON.stringify({
      applications:1,releases:1,publications:1,products:1,skus:1,listings:1,prices:1,stocks:1,audits:2,
    })) {
      throw new Error(`SANDBOX_CATALOG_REPLAY_INVALID:${JSON.stringify(result.rows[0])}`);
    }
  } finally {
    await database.exec('rollback');
  }
  const leaked=await database.query("select count(*)::integer count from catalog.product where id='product:zhudatuan:sandbox:welcome'");
  if (leaked.rows[0]?.count!==0) throw new Error('SANDBOX_CATALOG_REPLAY_LEAKED');
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
    (select count(*)::integer from member.invite
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
  const row=baseline.rows[0];
  if (JSON.stringify(row)!==JSON.stringify({ organizations:3,active_policies:1,canonical_policy:1,legacy_invites:0,legacy_employee_assignments:0,
    employee_role:1,employee_permissions:14,audit_records:1 })) {
    throw new Error(`ZHUDATUAN_REGISTRATION_BASELINE_INVALID:${JSON.stringify(row)}`);
  }
  await verifyPhoneAssuranceRevocation(database);
  await execute(database, await readFile(join(MIGRATIONS,'20260828170000_zhudatuan_registration_baseline.sql'),'utf8'),
    'idempotent zhudatuan registration baseline replay');
  const afterReplay = await zhudatuanRegistrationFingerprint(database);
  if (JSON.stringify(afterReplay)!==JSON.stringify(beforeReplay)) {
    throw new Error(`ZHUDATUAN_REGISTRATION_BASELINE_NOT_IDEMPOTENT:${JSON.stringify({ beforeReplay,afterReplay })}`);
  }
  // The historical baseline intentionally recreates its original policies.
  // Restore the immutable forward repair before any current-head ACL checks.
  const bootstrapRepair = await readFile(join(MIGRATIONS,REGISTRATION_BOOTSTRAP_REPAIR),'utf8');
  await execute(database,
    omitExactEnvironmentAssertion(bootstrapRepair,REGISTRATION_BOOTSTRAP_REPLAY_FUTURE_HEAD_ASSERTION,REGISTRATION_BOOTSTRAP_REPAIR),
    'idempotent zhudatuan registration bootstrap repair replay');
  const identityLoginAclRepair = await readFile(
    join(MIGRATIONS,IDENTITY_LOGIN_ACL_REPAIR),
    'utf8',
  );
  await execute(database,
    omitExactEnvironmentAssertion(
      identityLoginAclRepair,
      IDENTITY_LOGIN_ACL_REPLAY_FUTURE_HEAD_ASSERTION,
      IDENTITY_LOGIN_ACL_REPAIR,
    ),
    'idempotent zhudatuan identity login ACL repair replay');
  if (migrationFiles.includes(OPERATOR_INVITATION_REGISTRATION)) {
    const operatorInvitationRegistration = await readFile(
      join(MIGRATIONS,OPERATOR_INVITATION_REGISTRATION),
      'utf8',
    );
    await execute(database,
      omitExactEnvironmentAssertion(
        operatorInvitationRegistration,
        OPERATOR_INVITATION_REPLAY_FUTURE_HEAD_ASSERTION,
        OPERATOR_INVITATION_REGISTRATION,
      ),
      'idempotent zhudatuan operator invitation registration replay');
  }
}

async function verifyPhoneAssuranceRevocation(database) {
  const token='7'.repeat(64);
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
    const active=await database.query('select assurance_level from identity.resolve_session($1)',[token]);
    if (active.rows[0]?.assurance_level!==2) throw new Error(`PHONE_ASSURANCE_ACTIVE_INVALID:${JSON.stringify(active.rows)}`);
    await database.query("update identity.assurance set expires_at=clock_timestamp() where id='assurance:registration-assurance-replay'");
    const expired=await database.query('select assurance_level from identity.resolve_session($1)',[token]);
    if (expired.rows[0]?.assurance_level!==1) throw new Error(`PHONE_ASSURANCE_REVOCATION_INVALID:${JSON.stringify(expired.rows)}`);
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
    (select coalesce(sum(version),0)::text from member.invite
      where id='invite-demo-employee-2026') legacy_invitation_versions,
    (select count(*)::integer from audit.record where id like 'audit:zhudatuan:registration-baseline:%') audit_records,
    (select count(*)::integer from access.membership membership join member.profile profile on profile.id=membership.member_id
      join identity.principal principal on principal.id=profile.principal_id
      where membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
        and (membership.status in('active','invited') or profile.status='active' or principal.status='active')) unexpired_legacy_assignments`);
  return result.rows[0];
}

async function verifyExtensionLifecycle(database) {
  const hash='c'.repeat(64);
  const manifest=JSON.stringify({id:'replayprovider',kind:'channel',priority:1,version:'1.0.0',apiVersion:'2026-08-21',
    contractVersion:'replay.v1',healthOperation:'local',capabilities:['Catalog'],permissions:[],configSchema:'replay.v1',
    eventSubscriptions:[],secretRefs:[],limits:{connectionTimeoutMs:1,responseTimeoutMs:1,totalDeadlineMs:1,maxConcurrency:1,
      requestsPerSecond:1,maxAttempts:1,failureThreshold:1,recoveryMs:100},signature:'c2lnbmVk'});
  await database.query(`insert into extension.manifest(id,version,kind,contract_version,manifest,manifest_hash,signature,registered_at)
    values('replayprovider','1.0.0','channel','replay.v1',$1::jsonb,$2,'c2lnbmVk',clock_timestamp());`,[manifest,hash]);
  await database.exec(`insert into extension.contractversion(extension_id,contract_version,schema_hash,status)
    values('replayprovider','replay.v1','${hash}','verified');
    insert into extension.installation(id,extension_id,extension_version,scope_id,status,manifest,base_url,endpoints,secret_ref,health_operation,installed_at)
    values('extension:replay-active','replayprovider','1.0.0','rls-scope-a','enabled','${manifest}'::jsonb,'https://replay.invalid','{"local":"/health"}','secret/replay','local',clock_timestamp()),
      ('extension:replay-candidate','replayprovider','1.0.0','rls-scope-a','testing','${manifest}'::jsonb,'https://replay.invalid','{"local":"/health"}','secret/replay','local',clock_timestamp());`);
  let uniqueRejected=false;
  try { await database.exec("update extension.installation set status='enabled' where id='extension:replay-candidate'"); }
  catch (error) { if (!String(error instanceof Error?error.message:error).toLowerCase().includes('unique')) throw error; uniqueRejected=true; }
  if (!uniqueRejected) throw new Error('EXTENSION_SINGLE_ACTIVE_CONSTRAINT_MISSING');
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),
    set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','extension-auditor',true);`);
  const visible=await database.query("select id from extension.load_installation('extension:replay-candidate','rls-scope-a')");
  const manifestVisible=await database.query("select count(*)::integer count from extension.manifest where id='replayprovider'");
  await database.exec('commit');
  if (visible.rows[0]?.id!=='extension:replay-candidate' || manifestVisible.rows[0]?.count!==1) throw new Error('EXTENSION_SCOPE_POLICY_INVALID');
  let mutationRejected=false;
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true);`);
  try { await database.query("update extension.manifest set signature='forged' where id='replayprovider'"); }
  catch (error) { if (!String(error instanceof Error?error.message:error).toLowerCase().includes('permission')) throw error; mutationRejected=true; }
  await database.exec('rollback');
  if (!mutationRejected) throw new Error('EXTENSION_MANIFEST_MUTATION_ALLOWED');
}

async function verifyAuditImmutability(database) {
  const hash='b'.repeat(64);
  await database.exec(`insert into audit.record(id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,
    evidence,trace_id,previous_hash,record_hash,recorded_at) values('audit:immutability','organization-platform-root','audit-test','system',
    'audit.test','audit','audit:immutability',null,null,'{}','audit:test',null,'${hash}',clock_timestamp());`);
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),
    set_config('app.scope_id','organization-platform-root',true);`);
  let rejected=false; let changed=0;
  try { changed=(await database.query("update audit.record set action='mutated' where id='audit:immutability'")).rowCount ?? 0; }
  catch (error) {
    if (!String(error instanceof Error?error.message:error).includes('AUDIT_IMMUTABLE')) throw error;
    rejected=true;
  }
  await database.exec('rollback');
  if (!rejected && changed!==0) throw new Error('AUDIT_UPDATE_WAS_NOT_REJECTED');
  const unchanged=await database.query("select action from audit.record where id='audit:immutability'");
  if (unchanged.rows[0]?.action!=='audit.test') throw new Error('AUDIT_UPDATE_IMMUTABILITY_INVALID');
  await database.exec(`begin; set local role shopjob; select set_config('app.workload','jobs',true),set_config('app.audit_archive','true',true);
    delete from audit.record where id='audit:immutability'; commit;`);
  const deleted=await database.query("select count(*)::integer count from audit.record where id='audit:immutability'");
  if (deleted.rows[0]?.count!==0) throw new Error('AUDIT_ARCHIVE_DELETE_INVALID');
}

async function verifyExperiencePublication(database) {
  const hash = 'a'.repeat(64);
  await database.exec(`insert into experience.application(id,scope_id,code,public_slug,name,status,created_at,updated_at) values
    ('application:publication-audit','scope-publication-audit','PUBLICATION_AUDIT','publication-audit','Publication audit','active',clock_timestamp(),clock_timestamp());
    insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at) values
    ('version:publication-audit','application:publication-audit',1,'2','{"version":2,"application":"application:publication-audit","pages":[{"id":"home","path":"/","blocks":[]}]}',
      '${hash}','valid','publication audit fixture','audit',clock_timestamp());
    update experience.application set head_version_id='version:publication-audit' where id='application:publication-audit';
    insert into experience.release(id,application_id,version_id,state,effective_at,published_by) values
    ('release:publication-audit','application:publication-audit','version:publication-audit','active',clock_timestamp(),'audit');
    insert into experience.binding(application_id,domain,mall_id,pool_id) values
    ('application:publication-audit','audit.invalid','mall:publication-audit','pool:publication-audit');
    insert into experience.publication(id,release_id,application_id,version_id,content_hash,object_key,object_ref,object_hash,object_size,state,staged_at,published_at) values
    ('publication:audit','release:publication-audit','application:publication-audit','version:publication-audit','${hash}',
      'experience/application:publication-audit/${hash}.json','object:publication-audit','${hash}',1,'active',clock_timestamp(),clock_timestamp());`);
  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),set_config('app.scope_id','public:experience',true);`);
  const direct = await database.query("select count(*)::integer count from experience.publication where id='publication:audit'");
  const published = await database.query("select release,version,hash,object_key from experience.read_published('mall:publication-audit')");
  await database.exec('commit');
  if (direct.rows[0]?.count !== 0 || published.rows[0]?.release !== 'release:publication-audit' || published.rows[0]?.hash !== hash) {
    throw new Error('EXPERIENCE_PUBLICATION_SECURITY_INVALID');
  }
}

async function verifyRls(database) {
  await database.exec(`insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values
    ('rls-policy-a','rls-scope-a','RLS A','draft',1,clock_timestamp()),('rls-policy-b','rls-scope-b','RLS B','draft',1,clock_timestamp());`);
  await database.exec(`begin; set local role shopapp;
    select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','rls-auditor',true);`);
  const visible = await database.query("select array_agg(id order by id) ids from risk.policy where id like 'rls-policy-%'");
  await database.exec('commit');
  if (JSON.stringify(visible.rows[0]?.ids)!==JSON.stringify(['rls-policy-a'])) throw new Error('RLS_SCOPE_READ_ISOLATION_INVALID');
  await database.exec(`begin; set local role shopapp;
    select set_config('app.workload','api',true),set_config('app.scope_id','rls-scope-a',true),set_config('app.actor_id','rls-auditor',true);`);
  try {
    await database.query("insert into risk.policy(id,scope_id,name,status,next_version,updated_at) values('rls-policy-forbidden','rls-scope-b','forbidden','draft',1,clock_timestamp())");
  } catch (error) {
    await database.exec('rollback');
    if (!String(error instanceof Error ? error.message : error).toLowerCase().includes('row-level security')) throw error;
    return;
  }
  await database.exec('rollback');
  throw new Error('RLS_SCOPE_WRITE_ISOLATION_INVALID');
}

async function verifyObjectContract(database) {
  const contract = parse(await readFile(OBJECTS, 'utf8'));
  const entries = Array.isArray(contract?.objects) ? contract.objects : [];
  const schemas = entries.filter((entry) => entry.kind === 'schema').map((entry) => entry.id).sort();
  const expected = new Map([
    ['schema', new Set(schemas)],
    ['table', new Set(entries.filter((entry) => entry.kind === 'table').map((entry) => entry.id))],
    ['view', new Set(entries.filter((entry) => entry.kind === 'view').map((entry) => entry.id))],
    ['function', new Set(entries.filter((entry) => entry.kind === 'function').map((entry) => entry.id))],
    ['trigger', new Set(entries.filter((entry) => entry.kind === 'trigger').map((entry) => entry.id))],
    ['policy', new Set(entries.filter((entry) => entry.kind === 'policy').map((entry) => entry.id))],
    ['grant', new Set(entries.filter((entry) => entry.kind === 'grant').map((entry) => entry.id))],
  ]);
  if (mode === '--registration-fresh') {
    for (const id of [
      'access.membership.zhudatuanregistrationboundary_runtime_guard',
      'access.membershiprole.zhudatuanregistrationboundary_runtime_guard',
      'access.role.zhudatuanregistrationboundary_runtime_guard',
      'runtime.schemaversion.zhudatuanregistrationboundary_runtime_guard',
    ]) expected.get('policy').add(id);
  }
  const schemaRows = await database.query('select schema_name id from information_schema.schemata where schema_name=any($1::text[])', [schemas]);
  const tableRows = await database.query(`select namespace.nspname||'.'||relation.relname id,relation.relrowsecurity rls
    from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname=any($1::text[]) and relation.relkind in('r','p')`, [schemas]);
  const viewRows = await database.query(`select namespace.nspname||'.'||relation.relname id from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname=any($1::text[]) and relation.relkind in('v','m')`, [schemas]);
  const functionRows = await database.query(`select namespace.nspname||'.'||procedure.proname id from pg_proc procedure
    join pg_namespace namespace on namespace.oid=procedure.pronamespace where namespace.nspname=any($1::text[])`, [schemas]);
  const triggerRows = await database.query(`select namespace.nspname||'.'||relation.relname||'.'||trigger.tgname id from pg_trigger trigger
    join pg_class relation on relation.oid=trigger.tgrelid join pg_namespace namespace on namespace.oid=relation.relnamespace
    where not trigger.tgisinternal and namespace.nspname=any($1::text[])`, [schemas]);
  const policyRows = await database.query(`select schemaname||'.'||tablename||'.'||policyname id from pg_policies where schemaname=any($1::text[])`, [schemas]);
  compareSet('schema', expected.get('schema'), schemaRows.rows.map((row) => row.id));
  compareSet('table', expected.get('table'), tableRows.rows.map((row) => row.id));
  compareSet('view', expected.get('view'), viewRows.rows.map((row) => row.id));
  compareSet('function', expected.get('function'), functionRows.rows.map((row) => row.id));
  compareSet('trigger', expected.get('trigger'), triggerRows.rows.map((row) => row.id));
  compareSet('policy', expected.get('policy'), policyRows.rows.map((row) => row.id));
  if (tableRows.rows.some((row) => !row.rls)) throw new Error('DATABASE_OBJECT_RLS_DRIFT');

  const roleRows = await database.query(`with roles(role) as (values('shopapp'),('shopjob'),('shopmigration'),('shopread')),
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
      where role<>owner and has_function_privilege(role,oid,'EXECUTE')`, [schemas]);
  compareSet('grant', expected.get('grant'), roleRows.rows.map((row) => row.id));
}

function compareSet(kind, expected, actualValues) {
  const actual = new Set(actualValues);
  const missing = [...expected].filter((value) => !actual.has(value)).sort();
  const extra = [...actual].filter((value) => !expected.has(value)).sort();
  if (missing.length || extra.length) throw new Error(`DATABASE_OBJECT_${kind.toUpperCase()}_DRIFT:${JSON.stringify({ missing, extra })}`);
}
