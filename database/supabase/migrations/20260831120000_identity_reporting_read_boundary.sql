begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:identity-reporting-read-boundary:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'IDENTITY_REPORTING_READ_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260831110000'
      and checksum='3db3f787f77ba8e416d9056d611c40d76a1d46a65da5ae0767ee63e085ac7841') then
    raise exception 'IDENTITY_REPORTING_READ_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260831110000') then
    raise exception 'IDENTITY_REPORTING_READ_FUTURE_HEAD_INVALID';
  end if;
  if to_regrole('zhudatuanidentityapi') is null
    or array_position(array[to_regclass('reporting.fact'),to_regclass('reporting.metric')],null) is not null then
    raise exception 'IDENTITY_REPORTING_READ_RELATION_MISSING';
  end if;
end
$precondition$;

grant usage on schema reporting to zhudatuanidentityapi;
grant select on table reporting.fact,reporting.metric to zhudatuanidentityapi;
revoke insert,update,delete,truncate,references,trigger on table reporting.fact,reporting.metric from zhudatuanidentityapi;

create policy identityapiread on reporting.fact for select to zhudatuanidentityapi
  using(access.scope_allowed(scope_id));
create policy identityapiread on reporting.metric for select to zhudatuanidentityapi using(true);

insert into runtime.schemaversion(version,checksum)
values('20260831120000','b2b9fd82cba3e317a9ac237b2226ca0d5149d15dbe33656e15cb7ae1c36c5c9a');

do $assert$
declare relation_name text;
begin
  if not has_schema_privilege('zhudatuanidentityapi','reporting','USAGE') then
    raise exception 'IDENTITY_REPORTING_READ_SCHEMA_USAGE_INVALID';
  end if;
  foreach relation_name in array array['reporting.fact','reporting.metric'] loop
    if not has_table_privilege('zhudatuanidentityapi',relation_name,'SELECT')
      or has_table_privilege('zhudatuanidentityapi',relation_name,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception 'IDENTITY_REPORTING_READ_TABLE_ACL_INVALID:%',relation_name;
    end if;
  end loop;
  if not exists(select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname='reporting' and relation.relname='fact' and relation.relrowsecurity)
    or not exists(select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname='reporting' and relation.relname='metric' and relation.relrowsecurity) then
    raise exception 'IDENTITY_REPORTING_READ_RLS_DISABLED';
  end if;
  if (select count(*) from pg_policies where schemaname='reporting' and tablename=any(array['fact','metric'])
      and policyname='identityapiread' and cmd='SELECT' and 'zhudatuanidentityapi'=any(roles::text[]))<>2 then
    raise exception 'IDENTITY_REPORTING_READ_POLICY_INVALID';
  end if;
end
$assert$;

commit;
