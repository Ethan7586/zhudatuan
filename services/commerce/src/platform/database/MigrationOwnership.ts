import { Client, type QueryResult, type QueryResultRow } from 'pg';

export const OWNERSHIP_CUTOVER = '20260904065000_finalize_constraints.sql';
export const MIGRATION_ROLE_HARDENING_SQL =
  'alter role shopmigration nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls';

export interface MigrationOwnershipClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<R extends QueryResultRow = any>(queryText: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}

export async function withMigrationOwnership<T>(connectionString: string, action: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000, statement_timeout: 60_000 });
  await client.connect();
  try {
    return await executeWithMigrationOwnership(client, action);
  } finally {
    await client.end();
  }
}

export async function executeWithMigrationOwnership<T, Database extends MigrationOwnershipClient>(client: Database, action: (client: Database) => Promise<T>): Promise<T> {
  await client.query('begin');
  try {
    await assertMigrationRoleCanBeSet(client);
    await client.query("select pg_advisory_xact_lock(hashtext('shop-domain-hard-cut'))");
    await client.query(ownerInheritanceSql(true));
    await client.query('set local role shopmigration');
    await assertMigrationRole(client);
    const result = await action(client);
    await client.query('reset role');
    await client.query(ownerInheritanceSql(false));
    await assertOwnerInheritanceDisabled(client);
    await client.query('commit');
    return result;
  } catch (cause) {
    await client.query('rollback').catch(() => undefined);
    throw cause;
  }
}

async function assertMigrationRoleCanBeSet(client: MigrationOwnershipClient): Promise<void> {
  const result = await client.query<{ allowed: boolean }>("select pg_has_role(session_user,'shopmigration','set') allowed");
  if (result.rows[0]?.allowed !== true) throw new Error('MIGRATION_ROLE_SET_FORBIDDEN');
}

async function assertMigrationRole(client: MigrationOwnershipClient): Promise<void> {
  const result = await client.query<{ valid: boolean }>(`select current_user='shopmigration'
    and exists(select 1 from pg_roles where rolname=current_user and not rolcanlogin and not rolsuper
      and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls) valid`);
  if (result.rows[0]?.valid !== true) throw new Error('MIGRATION_ROLE_INVALID');
}

async function assertOwnerInheritanceDisabled(client: MigrationOwnershipClient): Promise<void> {
  const result = await client.query<{ valid: boolean }>(`select current_user=session_user and not exists(
    select 1 from pg_auth_members membership
    join pg_roles member_role on member_role.oid=membership.member
    join pg_roles owner_role on owner_role.oid=membership.roleid
    where member_role.rolname='shopmigration' and owner_role.rolname~'^shop[a-z]+owner$' and membership.inherit_option
  ) valid`);
  if (result.rows[0]?.valid !== true) throw new Error('MIGRATION_OWNER_INHERITANCE_RESTORE_FAILED');
}

export function ownerInheritanceSql(enabled: boolean): string {
  const inherit = enabled ? 'true' : 'false';
  return `do $owner_membership$
declare membership record; membership_count integer:=0;
begin
  for membership in
    select owner_role.rolname owner_role
    from pg_auth_members role_membership
    join pg_roles member_role on member_role.oid=role_membership.member
    join pg_roles owner_role on owner_role.oid=role_membership.roleid
    where member_role.rolname='shopmigration' and owner_role.rolname~'^shop[a-z]+owner$'
    order by owner_role.rolname
  loop
    execute format('grant %I to shopmigration with inherit ${inherit}, set true',membership.owner_role);
    membership_count:=membership_count+1;
  end loop;
  if membership_count=0 then raise exception 'MIGRATION_OWNER_MEMBERSHIPS_MISSING'; end if;
end
$owner_membership$;`;
}
