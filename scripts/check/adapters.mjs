import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { Client } from 'pg';
import { createClient } from 'redis';

const databaseUrl = process.env.SHOP_TEST_DATABASE_URL;
const redisUrl = process.env.SHOP_TEST_REDIS_URL;
if (!redisUrl || (!databaseUrl && !process.env.PGHOST)) throw new Error('ADAPTER_TEST_ENDPOINTS_REQUIRED');

const database = new Client({ ...(databaseUrl === undefined ? {} : { connectionString: databaseUrl }), connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
const redis = createClient({ url: redisUrl, socket: { connectTimeout: 5_000, reconnectStrategy: false } });
redis.on('error', () => undefined);
await Promise.all([database.connect(), redis.connect()]);
try {
  const target = await database.query("select count(*)::integer migrations,to_regclass('runtime.jobs')::text jobs from supabase_migrations.schema_migrations");
  const expectedMigrations = readdirSync('database/migrations').filter((name) => name.endsWith('.sql')).length;
  if (target.rows[0]?.migrations !== expectedMigrations || target.rows[0]?.jobs !== 'runtime.jobs') throw new Error('POSTGRES_ADAPTER_TARGET_INVALID');
  await database.query('begin');
  const job = `job:adapter:${randomUUID()}`;
  await database.query(
    `insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,idempotency_key,
      retention_until,version,created_by,updated_by,created_at,updated_at)
    values($1,'tenant:adapter','organization-platform-root','adaptercheck','runtime','maintenance','{}'::jsonb,'queued',1,
      clock_timestamp(),$1,clock_timestamp()+interval '1 day',1,'adaptercheck','adaptercheck',clock_timestamp(),clock_timestamp())`,
    [job]
  );
  const claim = await database.query("select id from runtime.jobs where id=$1 and state='queued' for update skip locked", [job]);
  if (claim.rows[0]?.id !== job) throw new Error('POSTGRES_QUEUE_CLAIM_INVALID');
  await database.query('rollback');

  const key = `shop:adapter:${randomUUID()}`;
  if ((await redis.set(key, 'lease', { NX: true, PX: 10_000 })) !== 'OK') throw new Error('REDIS_LEASE_CREATE_INVALID');
  if ((await redis.set(key, 'duplicate', { NX: true, PX: 10_000 })) !== null) throw new Error('REDIS_LEASE_DUPLICATE_INVALID');
  if ((await redis.get(key)) !== 'lease') throw new Error('REDIS_LEASE_READ_INVALID');
  await redis.del(key);
  console.log('adapter integration accepted: postgres=true redis=true queueclaim=true');
} finally {
  await Promise.allSettled([database.end(), redis.quit()]);
}
