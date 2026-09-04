import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { StagedSubject } from '../../application/port/DirectoryRepository';
import type { DirectoryConnection } from '../../domain/model/DirectoryConnection';

export async function writeDirectoryOrganization(database: SqlExecutor, connection: DirectoryConnection, subject: StagedSubject): Promise<void> {
  const parent = subject.parentorganization ?? connection.organizationid;
  const parentExists = await database.query(
    `select parent.id from organization.organization parent
     where parent.id=$1 and parent.status='active' and (parent.id=$2 or parent.kind='department')
       and exists(select 1 from organization.unitclosure boundary where boundary.ancestor_id=$2 and boundary.descendant_id=parent.id)`,
    [parent, connection.organizationid]
  );
  if (!parentExists.rows[0]) throw new Error('DIRECTORY_PARENT_NOT_FOUND');
  const current = await database.query<{ parent_id: string | null; visible: boolean }>(
    `select organization.parent_id,exists(select 1 from organization.unitclosure boundary
      where boundary.ancestor_id=$2 and boundary.descendant_id=organization.id) visible
     from organization.organization organization where organization.id=$1 and organization.kind='department' for update`,
    [subject.organization, connection.organizationid]
  );
  if (current.rows[0] && !current.rows[0].visible) throw new Error('DIRECTORY_SCOPE_BOUNDARY_VIOLATION');
  if (current.rows[0]?.parent_id !== undefined && current.rows[0].parent_id !== parent) {
    const cycle = await database.query('select 1 from organization.unitclosure where ancestor_id=$1 and descendant_id=$2', [subject.organization, parent]);
    if (cycle.rows[0]) throw new Error('DIRECTORY_HIERARCHY_CYCLE');
    await database.query(
      `delete from organization.unitclosure closure using organization.unitclosure subtree
      where subtree.ancestor_id=$1 and closure.descendant_id=subtree.descendant_id
        and closure.ancestor_id not in(select descendant_id from organization.unitclosure where ancestor_id=$1)`,
      [subject.organization]
    );
  }
  await database.query(
    `insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
    select $1,'department',$2,$3,parent.timezone,'active',0,clock_timestamp(),clock_timestamp() from organization.organization parent where parent.id=$2
    on conflict(id) do update set parent_id=excluded.parent_id,name=excluded.name,status='active',version=organization.organization.version+1,updated_at=clock_timestamp()`,
    [subject.organization, parent, subject.displayname]
  );
  await database.query(
    `insert into organization.sourcebinding(source_type,source_id,organization_id,source_code) values('directory',$1,$2,$3)
    on conflict(source_type,source_id) do update set organization_id=excluded.organization_id`,
    [subject.id, subject.organization, connection.providertype]
  );
  await database.query(
    `with subtree as(
      select descendant_id,depth from organization.unitclosure where ancestor_id=$1
      union all select $1,0 where not exists(select 1 from organization.unitclosure where ancestor_id=$1 and descendant_id=$1)
    ) insert into organization.unitclosure(ancestor_id,descendant_id,depth)
    select supertree.ancestor_id,subtree.descendant_id,supertree.depth+subtree.depth+1
    from organization.unitclosure supertree cross join subtree where supertree.descendant_id=$2
    union all select $1,descendant_id,depth from subtree
    on conflict(ancestor_id,descendant_id) do update set depth=excluded.depth`,
    [subject.organization, parent]
  );
}
