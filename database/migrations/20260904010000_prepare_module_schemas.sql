begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903116000') then
    raise exception 'MODULE_SCHEMAS_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260904010000') then
    raise exception 'MODULE_SCHEMAS_ALREADY_APPLIED';
  end if;
end
$precondition$;

create schema if not exists approval;
create schema if not exists navigation;
create schema if not exists observability;

create table runtime.moduleauthority(
  module_id text primary key check(module_id~'^[a-z]+$'),
  schema_name text not null unique check(schema_name~'^[a-z]+$'),
  owner_role text not null unique check(owner_role~'^shop[a-z]+owner$'),
  reader_role text not null unique check(reader_role~'^shop[a-z]+reader$'),
  writer_role text not null unique check(writer_role~'^shop[a-z]+writer$'),
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

insert into runtime.moduleauthority(module_id,schema_name,owner_role,reader_role,writer_role,version,created_at,updated_at) values
  ('runtime','runtime','shopruntimeowner','shopruntimereader','shopruntimewriter',1,clock_timestamp(),clock_timestamp()),
  ('observability','observability','shopobservabilityowner','shopobservabilityreader','shopobservabilitywriter',1,clock_timestamp(),clock_timestamp()),
  ('navigation','navigation','shopnavigationowner','shopnavigationreader','shopnavigationwriter',1,clock_timestamp(),clock_timestamp()),
  ('identity','identity','shopidentityowner','shopidentityreader','shopidentitywriter',1,clock_timestamp(),clock_timestamp()),
  ('organization','organization','shoporganizationowner','shoporganizationreader','shoporganizationwriter',1,clock_timestamp(),clock_timestamp()),
  ('access','access','shopaccessowner','shopaccessreader','shopaccesswriter',1,clock_timestamp(),clock_timestamp()),
  ('approval','approval','shopapprovalowner','shopapprovalreader','shopapprovalwriter',1,clock_timestamp(),clock_timestamp()),
  ('capability','capability','shopcapabilityowner','shopcapabilityreader','shopcapabilitywriter',1,clock_timestamp(),clock_timestamp()),
  ('partner','partner','shoppartnerowner','shoppartnerreader','shoppartnerwriter',1,clock_timestamp(),clock_timestamp()),
  ('member','member','shopmemberowner','shopmemberreader','shopmemberwriter',1,clock_timestamp(),clock_timestamp()),
  ('qualification','qualification','shopqualificationowner','shopqualificationreader','shopqualificationwriter',1,clock_timestamp(),clock_timestamp()),
  ('catalog','catalog','shopcatalogowner','shopcatalogreader','shopcatalogwriter',1,clock_timestamp(),clock_timestamp()),
  ('pricing','pricing','shoppricingowner','shoppricingreader','shoppricingwriter',1,clock_timestamp(),clock_timestamp()),
  ('inventory','inventory','shopinventoryowner','shopinventoryreader','shopinventorywriter',1,clock_timestamp(),clock_timestamp()),
  ('experience','experience','shopexperienceowner','shopexperiencereader','shopexperiencewriter',1,clock_timestamp(),clock_timestamp()),
  ('marketing','marketing','shopmarketingowner','shopmarketingreader','shopmarketingwriter',1,clock_timestamp(),clock_timestamp()),
  ('cart','cart','shopcartowner','shopcartreader','shopcartwriter',1,clock_timestamp(),clock_timestamp()),
  ('checkout','checkout','shopcheckoutowner','shopcheckoutreader','shopcheckoutwriter',1,clock_timestamp(),clock_timestamp()),
  ('order','ordering','shoporderowner','shoporderreader','shoporderwriter',1,clock_timestamp(),clock_timestamp()),
  ('fulfillment','fulfillment','shopfulfillmentowner','shopfulfillmentreader','shopfulfillmentwriter',1,clock_timestamp(),clock_timestamp()),
  ('verification','verification','shopverificationowner','shopverificationreader','shopverificationwriter',1,clock_timestamp(),clock_timestamp()),
  ('payment','payment','shoppaymentowner','shoppaymentreader','shoppaymentwriter',1,clock_timestamp(),clock_timestamp()),
  ('voucher','voucher','shopvoucherowner','shopvoucherreader','shopvoucherwriter',1,clock_timestamp(),clock_timestamp()),
  ('benefit','benefit','shopbenefitowner','shopbenefitreader','shopbenefitwriter',1,clock_timestamp(),clock_timestamp()),
  ('finance','finance','shopfinanceowner','shopfinancereader','shopfinancewriter',1,clock_timestamp(),clock_timestamp()),
  ('channel','channel','shopchannelowner','shopchannelreader','shopchannelwriter',1,clock_timestamp(),clock_timestamp()),
  ('support','support','shopsupportowner','shopsupportreader','shopsupportwriter',1,clock_timestamp(),clock_timestamp()),
  ('notification','notification','shopnotificationowner','shopnotificationreader','shopnotificationwriter',1,clock_timestamp(),clock_timestamp()),
  ('reporting','reporting','shopreportingowner','shopreportingreader','shopreportingwriter',1,clock_timestamp(),clock_timestamp()),
  ('referral','referral','shopreferralowner','shopreferralreader','shopreferralwriter',1,clock_timestamp(),clock_timestamp()),
  ('risk','risk','shopriskowner','shopriskreader','shopriskwriter',1,clock_timestamp(),clock_timestamp()),
  ('audit','audit','shopauditowner','shopauditreader','shopauditwriter',1,clock_timestamp(),clock_timestamp()),
  ('extension','extension','shopextensionowner','shopextensionreader','shopextensionwriter',1,clock_timestamp(),clock_timestamp());

select set_config('app.module_authorities',jsonb_agg(jsonb_build_object(
  'module',module_id,'schema',schema_name,'owner',owner_role,'reader',reader_role,'writer',writer_role
) order by module_id)::text,true)
from runtime.moduleauthority;

reset role;

do $roles$
declare authority record;
begin
  if current_user<>session_user
    or not coalesce((select rolcreaterole from pg_roles where rolname=current_user),false)
    or not pg_has_role(current_user,'shopmigration','set') then
    raise exception 'MODULE_ROLE_DEPLOYMENT_SESSION_INVALID';
  end if;
  for authority in select * from jsonb_to_recordset(current_setting('app.module_authorities')::jsonb)
    as source(module text,schema text,owner text,reader text,writer text) order by module loop
    if exists(select 1 from pg_roles where rolname in(authority.owner,authority.reader,authority.writer)
      and (rolcanlogin or rolinherit or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) then
      raise exception 'MODULE_ROLE_UNSAFE:%',authority.module;
    end if;
    if not exists(select 1 from pg_roles where rolname=authority.owner) then
      execute format('create role %I nologin noinherit',authority.owner);
    end if;
    if not exists(select 1 from pg_roles where rolname=authority.reader) then
      execute format('create role %I nologin noinherit',authority.reader);
    end if;
    if not exists(select 1 from pg_roles where rolname=authority.writer) then
      execute format('create role %I nologin noinherit',authority.writer);
    end if;
    execute format('grant %I to shopmigration with inherit false, set true',authority.owner);
  end loop;
end
$roles$;

set role shopmigration;

do $privileges$
declare authority record;
begin
  for authority in select * from runtime.moduleauthority order by module_id loop
    execute format('grant usage on schema %I to %I,%I',authority.schema_name,authority.reader_role,authority.writer_role);
    execute format('grant usage,create on schema %I to %I',authority.schema_name,authority.owner_role);
    execute format('alter default privileges for role shopmigration in schema %I grant select on tables to %I',authority.schema_name,authority.reader_role);
    execute format('alter default privileges for role shopmigration in schema %I grant select,insert,update,delete on tables to %I',authority.schema_name,authority.writer_role);
    execute format('alter default privileges for role shopmigration in schema %I grant usage,select on sequences to %I,%I',authority.schema_name,authority.reader_role,authority.writer_role);
    execute format('alter default privileges for role shopmigration in schema %I grant execute on functions to %I,%I',authority.schema_name,authority.reader_role,authority.writer_role);
  end loop;
end
$privileges$;

revoke all on schema approval,navigation,observability from public;
grant usage on schema approval,navigation,observability to shopapp,shopjob;
grant usage,create on schema approval,navigation,observability to shopmigration;
revoke all on table runtime.moduleauthority from public;
alter table runtime.moduleauthority enable row level security;
alter table runtime.moduleauthority force row level security;
create policy moduleauthorityread on runtime.moduleauthority for select to shopread,shopapp,shopjob using(true);
create policy moduleauthoritymigration on runtime.moduleauthority for select to shopmigration using(true);
grant select on runtime.moduleauthority to shopread,shopapp,shopjob;

select runtime.record_migration_evidence(
  '20260904010000',33,33,0,0,
  'select module_id,schema_name,owner_role,reader_role,writer_role from runtime.moduleauthority order by module_id;',
  'select count(*) module_count,count(distinct schema_name) schema_count from runtime.moduleauthority;'
);

insert into runtime.schemaversion(version,checksum)
values('20260904010000',encode(public.digest('20260904010000_prepare_module_schemas','sha256'),'hex'));

do $assert$
declare authority record;
begin
  if (select count(*) from runtime.moduleauthority)<>33 then raise exception 'MODULE_AUTHORITY_COUNT_INVALID'; end if;
  for authority in select * from runtime.moduleauthority loop
    if not exists(select 1 from pg_namespace where nspname=authority.schema_name) then raise exception 'MODULE_SCHEMA_MISSING:%',authority.schema_name; end if;
    if not exists(select 1 from pg_roles where rolname=authority.owner_role and not rolcanlogin and not rolinherit)
      or not exists(select 1 from pg_roles where rolname=authority.reader_role and not rolcanlogin and not rolinherit)
      or not exists(select 1 from pg_roles where rolname=authority.writer_role and not rolcanlogin and not rolinherit) then
      raise exception 'MODULE_ROLE_INVALID:%',authority.module_id;
    end if;
  end loop;
end
$assert$;

drop policy moduleauthoritymigration on runtime.moduleauthority;

commit;
