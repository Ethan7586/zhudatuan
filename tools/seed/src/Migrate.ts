import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { localSecret } from './LocalSecrets';
import { run } from './Process';
import { MIGRATION_PHASES } from '@shop/config/server';

const environment = localSeedEnvironment();
const adminConnection = await localSecret(environment.adminDatabaseConnectionRef);
const databaseName = canonicalDatabaseName(adminConnection);
await withAdmin(adminConnection, async (admin) => {
  if (!(await schemaExists(adminConnection))) {
    await admin.query(`do $$ begin
      if not exists(select 1 from pg_roles where rolname='shopread') then create role shopread nologin; end if;
    end $$`);
    await admin.query('grant shopapp,shopjob to shopmigration');
    await admin.query(`alter database "${databaseName}" owner to shopmigration`);
    await run(process.execPath, ['scripts/audit/database-contracts.mjs', '--postgres-fresh', adminConnection, 'shopmigration']);
  }
  await admin.query('alter role shopmigration nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls');
});
try {
  await run('npm', ['run', 'build:commerce']);
  for (const phase of MIGRATION_PHASES) {
    await run(process.execPath, ['--env-file=services/commerce/.env.local', 'services/commerce/dist/MigrationMain.js'], { ...process.env, MIGRATION_PHASE: phase });
  }
} finally {
  await withAdmin(adminConnection, async (admin) => {
    await admin.query('alter role shopmigration nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls');
  });
}
process.stdout.write('LOCAL_MIGRATIONS_READY\n');

function canonicalDatabaseName(connectionString: string): string {
  const databaseName = decodeURIComponent(new URL(connectionString).pathname.slice(1));
  if (databaseName !== 'zhudatuan_registration') throw new Error('LOCAL_DATABASE_NAME_INVALID');
  return databaseName;
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

async function withAdmin(connectionString: string, action: (client: Client) => Promise<void>): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await action(client);
  } finally {
    await client.end();
  }
}
