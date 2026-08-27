import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { localSecret } from './LocalSecrets';
import { run } from './Process';

const environment = localSeedEnvironment();
const [adminConnection, migrationConnection] = await Promise.all([
  localSecret(environment.adminDatabaseConnectionRef),
  localSecret(environment.migrationDatabaseConnectionRef),
]);
if (!await schemaExists(adminConnection)) {
  const admin = new Client({ connectionString: adminConnection });
  await admin.connect();
  try {
    await admin.query(`do $$ begin
      if not exists(select 1 from pg_roles where rolname='shopread') then create role shopread nologin; end if;
    end $$`);
    await admin.query('grant shopapp,shopjob to shopmigration');
    await admin.query('alter database shop owner to shopmigration');
  } finally {
    await admin.end();
  }
  await run(process.execPath, ['scripts/audit/database-contracts.mjs', '--postgres-fresh', adminConnection, 'shopmigration']);
}
await run('npm', ['run', 'build:commerce']);
await run(process.execPath, ['--env-file=services/commerce/.env.local', 'services/commerce/dist/MigrationMain.js']);
process.stdout.write('LOCAL_MIGRATIONS_READY\n');

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
