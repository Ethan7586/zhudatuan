import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { PasswordPolicy } from '../../../../01_core_hexin/services/commerce/src/modules/identity';
import { localSecret } from './LocalSecrets';
import { ownerPasswordFingerprint, ownerSubjectHash } from './OwnerBootstrapPlan';
import { run } from './Process';

const environment = localSeedEnvironment();
const [adminConnection, migrationConnection, bootstrapConnection, ownerPassword, identityKey, databaseSentinel] = await Promise.all([
  localSecret(environment.adminDatabaseConnectionRef),
  localSecret(environment.migrationDatabaseConnectionRef),
  localSecret('shop/local/database/bootstrap'),
  localSecret(environment.ethanPasswordRef),
  localSecret(environment.identityKeyRef),
  localSecret('local/database/sentinel'),
]);
if (!await schemaExists(adminConnection)) {
  const admin = new Client({ connectionString: adminConnection });
  await admin.connect();
  try {
    await admin.query(`do $$ begin
      if not exists(select 1 from pg_roles where rolname='shopread') then create role shopread nologin; end if;
    end $$`);
    await admin.query('grant shopapp,shopjob to shopmigration');
    await admin.query('alter database zhudatuan_registration owner to shopmigration');
  } finally {
    await admin.end();
  }
  try {
    await run(process.execPath, ['04_tools/scripts/audit/database-contracts.mjs', '--postgres-fresh', adminConnection, 'shopmigration']);
  } catch (cause) {
    if (!await ownerBootstrapPending(adminConnection)) throw cause;
  }
}
await run('npm', ['run', 'build:commerce']);
let migrationsCompleted = false;
if (!await ownerBootstrapPending(adminConnection)) {
  try {
    await runMigrations();
    migrationsCompleted = true;
  } catch (cause) {
    if (!await ownerBootstrapPending(adminConnection)) throw cause;
  }
}
if (!migrationsCompleted) {
  if (await ownerBootstrapPending(adminConnection)) {
    await preserveLocalOwnerLegacyTombstone(adminConnection);
    await bootstrapLocalOwner(bootstrapConnection, databaseSentinel, identityKey, ownerPassword);
  }
  await runMigrations();
}
process.stdout.write('LOCAL_MIGRATIONS_READY\n');

async function runMigrations(): Promise<void> {
  await run(process.execPath, ['--env-file=01_core_hexin/services/commerce/.env.local', '01_core_hexin/services/commerce/dist/MigrationMain.js']);
}

async function ownerBootstrapPending(connectionString: string): Promise<boolean> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<{ pending: boolean }>(`select
      coalesce((select max(version)='20260829190000' from runtime.schemaversion),false)
      and to_regprocedure('deployment.bootstrap_zhudatuan_owner(text,text,text,text,text)') is not null
      and not exists(
        select 1 from access.membership membership
        join access.membershiprole assignment on assignment.membership_id=membership.id
        where assignment.role_id='role-platform-owner-v2' and membership.status='active'
          and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
      ) pending`);
    return result.rows[0]?.pending === true;
  } finally {
    await client.end();
  }
}

async function preserveLocalOwnerLegacyTombstone(connectionString: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(`do $preserve$
    declare
      canonical_memberships integer;
      canonical_roles integer;
      canonical_scopes integer;
    begin
      select count(*) into canonical_memberships
      from access.membership
      where id='membership-platform-owner-ethan-v1';

      if canonical_memberships=0 then return; end if;

      if canonical_memberships<>1
        or not exists(
          select 1 from access.membership
          where id='membership-platform-owner-ethan-v1'
            and member_id='member-fresh-replay-ethan'
            and organization_id='mall-demo'
            and client='operator'
            and status='suspended'
        )
        or exists(select 1 from access.membership where id='membership-legacy-platform-owner-ethan-v1') then
        raise exception 'LOCAL_OWNER_LEGACY_TOMBSTONE_SHAPE_MISMATCH';
      end if;

      select count(*) into canonical_roles
      from access.membershiprole
      where membership_id='membership-platform-owner-ethan-v1';
      select count(*) into canonical_scopes
      from access.scopegrant
      where membership_id='membership-platform-owner-ethan-v1';

      if canonical_roles<>2 or canonical_scopes<>3
        or exists(select 1 from access.membershiprole where membership_id='membership-legacy-platform-owner-ethan-v1')
        or exists(select 1 from access.scopegrant where membership_id='membership-legacy-platform-owner-ethan-v1')
        or exists(select 1 from access.actionproof where membership_id='membership-platform-owner-ethan-v1')
        or exists(select 1 from identity.session where membership_id='membership-platform-owner-ethan-v1') then
        raise exception 'LOCAL_OWNER_LEGACY_RELATIONS_SHAPE_MISMATCH';
      end if;

      update access.membership
      set id='membership-legacy-platform-owner-ethan-v1'
      where id='membership-platform-owner-ethan-v1';

      update access.membershiprole
      set membership_id='membership-legacy-platform-owner-ethan-v1'
      where membership_id='membership-platform-owner-ethan-v1';

      update access.scopegrant
      set membership_id='membership-legacy-platform-owner-ethan-v1',
          id=replace(id,'scope:membership-platform-owner-ethan-v1:','scope:membership-legacy-platform-owner-ethan-v1:')
      where membership_id='membership-platform-owner-ethan-v1';
    end
    $preserve$`);
    await client.query('commit');
    process.stdout.write('LOCAL_OWNER_LEGACY_TOMBSTONE_READY\n');
  } catch (cause) {
    await client.query('rollback');
    throw cause;
  } finally {
    await client.end();
  }
}

async function bootstrapLocalOwner(connectionString: string, sentinel: string, identityKey: string, password: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const secretHash = await new PasswordPolicy().hash(password);
    const result = await client.query<{ state: string }>(
      'select deployment.bootstrap_zhudatuan_owner($1,$2,$3,$4,$5) state',
      [sentinel, ownerSubjectHash(identityKey), secretHash, ownerPasswordFingerprint(identityKey, password), 'owner:Ethan'],
    );
    if (!['created', 'existing'].includes(result.rows[0]?.state ?? '')) throw new Error('LOCAL_OWNER_BOOTSTRAP_RESULT_INVALID');
    process.stdout.write(`LOCAL_OWNER_BOOTSTRAP_READY state=${result.rows[0]?.state}\n`);
  } finally {
    await client.end();
  }
}

async function schemaExists(connectionString: string): Promise<boolean> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<{ ready: boolean }>("select to_regclass('runtime.schemaversion') is not null ready");
    return result.rows[0]?.ready === true;
  } finally {
    await client.end();
  }
}
