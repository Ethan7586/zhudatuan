begin;

create temporary table owner_membership_release_before on commit drop as
select count(*)::bigint rows_count
from access.membership
where id in('membership-platform-owner-ethan-v1','membership-archive-platform-owner-ethan-v1');

do $precondition$
declare
  dependency record;
  referenced boolean;
begin
  if not exists(select 1 from runtime.schemaversion where version='20260908010000') then
    raise exception 'OWNER_MEMBERSHIP_RELEASE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260908011000') then
    raise exception 'OWNER_MEMBERSHIP_RELEASE_ALREADY_APPLIED';
  end if;
  if exists(
    select 1 from access.membership
    where id='membership-platform-owner-ethan-v1'
      and not (
        member_id='member-fresh-replay-ethan' and principal_id='member-fresh-replay-ethan'
        and organization_id='mall-demo' and client='operator' and status='suspended'
      )
      and not (
        member_id='member:zhudatuan:owner:ethan:v1' and principal_id='principal:zhudatuan:owner:ethan:v1'
        and organization_id='tenant-zhudatuan' and client='operator' and status='active'
      )
  ) then
    raise exception 'OWNER_MEMBERSHIP_RELEASE_COLLISION';
  end if;
  if exists(
    select 1 from access.membership
    where id='membership-platform-owner-ethan-v1'
      and member_id='member-fresh-replay-ethan' and principal_id='member-fresh-replay-ethan'
      and organization_id='mall-demo' and client='operator' and status='suspended'
  ) and exists(select 1 from access.membership where id='membership-archive-platform-owner-ethan-v1') then
    raise exception 'OWNER_MEMBERSHIP_ARCHIVE_COLLISION';
  end if;

  if exists(
    select 1 from access.membership
    where id='membership-platform-owner-ethan-v1'
      and member_id='member-fresh-replay-ethan' and principal_id='member-fresh-replay-ethan'
      and organization_id='mall-demo' and client='operator' and status='suspended'
  ) then
    for dependency in
      select namespace.nspname schema_name,relation.relname table_name,column_name.attname column_name
      from pg_constraint reference
      join pg_class relation on relation.oid=reference.conrelid
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      join unnest(reference.conkey) with ordinality referencing(attnum,position) on true
      join unnest(reference.confkey) with ordinality referenced_column(attnum,position) using(position)
      join pg_attribute column_name on column_name.attrelid=relation.oid and column_name.attnum=referencing.attnum
      where reference.contype='f' and reference.confrelid='access.membership'::regclass
    loop
      execute format('select exists(select 1 from %I.%I where %I=$1)',dependency.schema_name,dependency.table_name,dependency.column_name)
        into referenced using 'membership-platform-owner-ethan-v1';
      if referenced then raise exception 'OWNER_MEMBERSHIP_RELEASE_REFERENCED:%.%.%',dependency.schema_name,dependency.table_name,dependency.column_name; end if;
    end loop;
  end if;
end
$precondition$;

update access.membershiprole
set membership_id='membership-archive-platform-owner-ethan-v1'
where membership_id='membership-platform-owner-ethan-v1'
  and exists(
    select 1 from access.membership
    where id='membership-platform-owner-ethan-v1'
      and member_id='member-fresh-replay-ethan' and principal_id='member-fresh-replay-ethan'
      and organization_id='mall-demo' and client='operator' and status='suspended'
  );

update access.scopegrant
set id=replace(id,'scope:membership-platform-owner-ethan-v1:','scope:membership-archive-platform-owner-ethan-v1:'),
  membership_id='membership-archive-platform-owner-ethan-v1'
where membership_id='membership-platform-owner-ethan-v1'
  and exists(
    select 1 from access.membership
    where id='membership-platform-owner-ethan-v1'
      and member_id='member-fresh-replay-ethan' and principal_id='member-fresh-replay-ethan'
      and organization_id='mall-demo' and client='operator' and status='suspended'
  );

alter table access.membership disable trigger access_membership_principal_immutable;
update access.membership
set id='membership-archive-platform-owner-ethan-v1'
where id='membership-platform-owner-ethan-v1'
  and member_id='member-fresh-replay-ethan' and principal_id='member-fresh-replay-ethan'
  and organization_id='mall-demo' and client='operator' and status='suspended';
alter table access.membership enable trigger access_membership_principal_immutable;

select runtime.record_migration_evidence(
  '20260908011000',before.rows_count,after.rows_count,0,0,
  'select id,member_id,principal_id,organization_id,client,status from access.membership where id in(''membership-platform-owner-ethan-v1'',''membership-archive-platform-owner-ethan-v1'') order by id;',
  'select membership_id,role_id,effective_at,expires_at from access.membershiprole where membership_id in(''membership-platform-owner-ethan-v1'',''membership-archive-platform-owner-ethan-v1'') order by membership_id,role_id,effective_at;'
)
from owner_membership_release_before before
cross join (
  select count(*)::bigint rows_count from access.membership
  where id in('membership-platform-owner-ethan-v1','membership-archive-platform-owner-ethan-v1')
) after;

insert into runtime.schemaversion(version,checksum)
values('20260908011000',encode(public.digest('20260908011000_release_owner_membership_identity','sha256'),'hex'));
update runtime.schemahead set migration_head='20260908011000',migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:access',published_at=clock_timestamp() where artifact='commerce';

do $assert$
begin
  if exists(
    select 1 from access.membership
    where id='membership-platform-owner-ethan-v1'
      and (member_id,principal_id,organization_id,client,status) is distinct from
        ('member:zhudatuan:owner:ethan:v1','principal:zhudatuan:owner:ethan:v1','tenant-zhudatuan','operator','active')
  ) then raise exception 'OWNER_MEMBERSHIP_ID_NOT_RELEASED'; end if;
  if exists(select 1 from access.membership where id='membership-archive-platform-owner-ethan-v1') and (
    exists(select 1 from access.membershiprole where membership_id='membership-platform-owner-ethan-v1')
    or exists(select 1 from access.scopegrant where membership_id='membership-platform-owner-ethan-v1')
  ) then raise exception 'OWNER_MEMBERSHIP_ARCHIVE_CHILDREN_REMAIN'; end if;
  if not exists(
    select 1 from pg_trigger
    where tgrelid='access.membership'::regclass and tgname='access_membership_principal_immutable' and tgenabled='O'
  ) then raise exception 'OWNER_MEMBERSHIP_IMMUTABILITY_DISABLED'; end if;
  if (select rows_count from owner_membership_release_before)<>(
    select count(*) from access.membership
    where id in('membership-platform-owner-ethan-v1','membership-archive-platform-owner-ethan-v1')
  ) then raise exception 'OWNER_MEMBERSHIP_RELEASE_COUNT_MISMATCH'; end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce' and migration_head='20260908011000'
    and migration_count=(select count(*) from runtime.schemaversion)) then raise exception 'OWNER_MEMBERSHIP_RELEASE_HEAD_INVALID'; end if;
end
$assert$;

commit;
