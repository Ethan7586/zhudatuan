begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904056000') then raise exception 'IDEAL_SECURITY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904057000') then raise exception 'IDEAL_SECURITY_ALREADY_APPLIED'; end if;
end
$precondition$;

create table access.purposeproof(
  id text primary key check(id~'^purposeproof:'),
  tenant_id text not null,
  scope_id text not null,
  actor_id text not null,
  purpose text not null check(purpose in('fulfillment','support','finance','security','fraud','legal')),
  resource_type text not null,
  resource_hash char(64) not null check(resource_hash~'^[0-9a-f]{64}$'),
  authorization_hash char(64) not null check(authorization_hash~'^[0-9a-f]{64}$'),
  issued_at timestamptz not null,
  expires_at timestamptz not null check(expires_at>issued_at),
  consumed_at timestamptz,
  consumed_by text,
  version bigint not null check(version>0),
  check((consumed_at is null)=(consumed_by is null))
);
create index access_purposeproof_active on access.purposeproof(actor_id,purpose,expires_at,id)
  include(scope_id,resource_type,resource_hash) where consumed_at is null;
alter table access.purposeproof enable row level security;
alter table access.purposeproof force row level security;
create policy purposeproofapp on access.purposeproof for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy purposeproofjob on access.purposeproof for all to shopjob using(true) with check(true);
revoke all on access.purposeproof from public;
grant select,insert,update on access.purposeproof to shopapp,shopjob;

create table audit.sensitiveaccess(
  id text primary key check(id~'^sensitiveaccess:'),
  tenant_id text not null,
  scope_id text not null,
  actor_id text not null,
  purpose text not null,
  proof_id text not null,
  resource_type text not null,
  resource_hash char(64) not null check(resource_hash~'^[0-9a-f]{64}$'),
  fields text[] not null check(cardinality(fields)>0),
  decision text not null check(decision in('allow','deny')),
  trace_id text not null,
  occurred_at timestamptz not null,
  version bigint not null check(version>0),
  unique(trace_id,resource_hash)
);
create index audit_sensitiveaccess_scope on audit.sensitiveaccess(scope_id,occurred_at desc,id)
  include(actor_id,purpose,resource_type,decision,trace_id);
alter table audit.sensitiveaccess enable row level security;
alter table audit.sensitiveaccess force row level security;
create policy sensitiveaccessapp on audit.sensitiveaccess for select to shopapp using(access.scope_allowed(scope_id));
create policy sensitiveaccessjob on audit.sensitiveaccess for all to shopjob using(true) with check(true);
revoke all on audit.sensitiveaccess from public;
grant select on audit.sensitiveaccess to shopapp;
grant select,insert on audit.sensitiveaccess to shopjob;
create trigger audit_sensitiveaccess_immutable before update or delete on audit.sensitiveaccess
  for each row execute function runtime.reject_receipt_mutation();

do $privileges$
declare authority record; target record;
begin
  for authority in select * from runtime.moduleauthority loop
    for target in select schemaname,tablename from pg_tables where schemaname in(select schema_name from runtime.moduleauthority)
      and schemaname<>authority.schema_name
    loop
      execute format('revoke insert,update,delete,truncate,references,trigger on table %I.%I from %I',
        target.schemaname,target.tablename,authority.writer_role);
    end loop;
  end loop;
  for target in select schemaname,tablename from pg_tables where schemaname in(select schema_name from runtime.moduleauthority)
  loop
    execute format('revoke all on table %I.%I from public',target.schemaname,target.tablename);
  end loop;
end
$privileges$;

select runtime.record_migration_evidence('20260904057000',0,0,0,0,
  'select table_schema,table_name from information_schema.tables where table_schema in(select schema_name from runtime.moduleauthority) order by table_schema,table_name;',
  'select actor_id,purpose,resource_type,decision,count(*) from audit.sensitiveaccess group by actor_id,purpose,resource_type,decision;');
insert into runtime.schemaversion(version,checksum)
values('20260904057000',encode(public.digest('20260904057000_prepare_security_controls','sha256'),'hex'));

commit;
