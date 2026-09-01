import { parseArgs } from 'node:util';
import pg from 'pg';

const { values } = parseArgs({
  options: {
    url: { type: 'string', short: 'u', default: process.env.PRODUCT_PREVIEW_DATABASE_URL },
    database: { type: 'string', short: 'd', default: process.env.PRODUCT_PREVIEW_DATABASE_NAME },
  },
});
if (!values.url) throw new Error('PRODUCT_PREVIEW_DATABASE_URL_MISSING');
if (!values.database) throw new Error('PRODUCT_PREVIEW_DATABASE_NAME_MISSING');

const endpoint = new URL(values.url);
if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(endpoint.hostname)) {
  throw new Error(`PRODUCT_PREVIEW_DATABASE_NOT_LOCAL:${endpoint.hostname}`);
}
const client = new pg.Client({ connectionString: values.url, application_name: 'zhudatuan-product-000a-readonly-check' });

try {
  await client.connect();
  await client.query('begin read only');
  const identity = await client.query(`select current_database() database,current_user database_user,
    inet_server_addr()::text server_address,inet_server_port() server_port,pg_is_in_recovery() recovery`);
  const actual = identity.rows[0];
  if (actual?.database !== values.database) {
    throw new Error(`PRODUCT_PREVIEW_DATABASE_MISMATCH:expected=${values.database}:actual=${actual?.database ?? '(missing)'}`);
  }
  const schema = await client.query(`select
    to_regclass('runtime.schemaversion')::text migration_ledger,
    to_regclass('runtime.operation')::text operation_catalog,
    to_regclass('catalog.product')::text product_table,
    case when to_regclass('runtime.schemaversion') is null then null
      else (select version from runtime.schemaversion order by applied_at desc,version desc limit 1) end schema_head`);
  const counts = await client.query(`select
    case when to_regclass('catalog.product') is null then null else (select count(*)::integer from catalog.product) end products,
    case when to_regclass('catalog.sku') is null then null else (select count(*)::integer from catalog.sku) end skus,
    case when to_regclass('catalog.listing') is null then null else (select count(*)::integer from catalog.listing) end listings`);
  await client.query('rollback');
  console.log(JSON.stringify({ identity: actual, schema: schema.rows[0], facts: counts.rows[0] }));
  if (schema.rows[0]?.migration_ledger !== 'runtime.schemaversion' || schema.rows[0]?.operation_catalog !== 'runtime.operation' || schema.rows[0]?.product_table !== 'catalog.product') {
    throw new Error('PRODUCT_PREVIEW_DATABASE_NOT_MIGRATED');
  }
  console.log('result=PASS');
} catch (cause) {
  await client.query('rollback').catch(() => undefined);
  throw cause;
} finally {
  await client.end().catch(() => undefined);
}
