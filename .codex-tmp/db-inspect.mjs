import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
});

async function query(text, values = []) {
  try {
    const result = await pool.query(text, values);
    console.log(JSON.stringify({ ok: true, rows: result.rows }));
  } catch (error) {
    console.log(JSON.stringify({ ok: false, code: error.code, message: error.message }));
  }
}

try {
  await query('select current_user,current_database(),version()');
  await query("select schema_name from information_schema.schemata where schema_name in ('runtime','identity','access','catalog','order','reporting','support','experience') order by 1");
  await query('select version,checksum,applied_at from runtime.schemaversion order by applied_at desc nulls last limit 20');
  await query("select rolname,rolcanlogin,rolsuper,rolcreaterole,rolbypassrls from pg_roles where rolname in ('postgres','shopapp','shopjob','shopmigration','shopprovider') order by 1");
  await query("select (select count(*) from identity.principal) principals,(select count(*) from access.membership) memberships,(select count(*) from catalog.product) products,(select count(*) from experience.application) applications");
} finally {
  await pool.end();
}
