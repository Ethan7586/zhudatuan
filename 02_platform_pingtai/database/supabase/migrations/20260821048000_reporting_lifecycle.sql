begin;

alter table reporting.export add column authorization_snapshot jsonb;
update reporting.export set authorization_snapshot=jsonb_build_object('scope',scope_id,'source','migration');
alter table reporting.export alter column authorization_snapshot set not null;
alter table reporting.export add column cursor text;
alter table reporting.export add column record_count bigint not null default 0 check(record_count>=0);
alter table reporting.export alter column record_count drop default;
alter table reporting.export add column object_size bigint check(object_size>0);
alter table reporting.export add column scan_state text check(scan_state in('pending','clean','rejected'));
alter table reporting.export add column started_at timestamptz;
alter table reporting.export add column generated_at timestamptz;
alter table reporting.export add column error_code text;
update reporting.export set state='expired',object_ref=null,sha256=null,expires_at=coalesce(expires_at,clock_timestamp()),
  cursor=null,record_count=0 where state='completed';
alter table reporting.export add constraint reporting_export_report check(report in('metrics','orders','finance.statement'));
alter table reporting.export add constraint reporting_export_filter check(jsonb_typeof(filter)='object' and pg_column_size(filter)<=16384);
alter table reporting.export add constraint reporting_export_authorization check(jsonb_typeof(authorization_snapshot)='object' and authorization_snapshot?'scope');
alter table reporting.export add constraint reporting_export_object check(
  (state='completed')=(object_ref is not null and sha256 is not null and object_size is not null and scan_state='clean'
    and generated_at is not null and expires_at is not null));

create table reporting.projectionevent(
  event_id text primary key,
  event_type text not null,
  event_version integer not null check(event_version>0),
  aggregate_id text not null,
  scope_id text not null,
  occurred_at timestamptz not null,
  projected_at timestamptz not null
);

create index reporting_fact_scope_period on reporting.fact(scope_id,period_end desc,metric_id,metric_version);
create index reporting_fact_scope_application_period on reporting.fact(scope_id,(dimensions->>'application'),period_end desc);
create index reporting_export_scope_time on reporting.export(scope_id,created_at desc,id desc);
create index reporting_export_state on reporting.export(state,created_at) where state in('queued','running');
create index reporting_order_scope_export on reporting.orderprojection(scope_id,order_id);
create index reporting_finance_scope_export on reporting.financeprojection(scope_id,statement_id);
create index reporting_projection_aggregate on reporting.projectionevent(aggregate_id,occurred_at,event_id);

alter table reporting.projectionevent enable row level security;
create policy appscope on reporting.projectionevent for select to shopapp using(access.scope_allowed(scope_id));
create policy jobscope on reporting.projectionevent for all to shopjob using(true) with check(true);
grant select,insert,update,delete on reporting.projectionevent to shopapp,shopjob;

create or replace function reporting.resource_scope(p_resource text) returns text language sql stable security definer
set search_path=reporting,pg_temp as $function$
  select scope_id from reporting.export where id=p_resource
$function$;
revoke all on function reporting.resource_scope(text) from public;

do $rewrite$ declare definition text; replaced text; begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into definition;
  replaced:=replace(definition,'select notification.resource_scope(p_resource) into resolved',
    'select notification.resource_scope(p_resource) into resolved; end if; if resolved is null then select reporting.resource_scope(p_resource) into resolved');
  if replaced=definition then raise exception 'ACCESS_RESOURCE_SCOPE_REPORTING_REWRITE_FAILED'; end if;
  definition:=replaced;
  replaced:=replace(definition,'''notification.announcements.manage'',''risk.policies.manage''',
    '''notification.announcements.manage'',''reporting.exports.create'',''risk.policies.manage''');
  if replaced=definition then raise exception 'ACCESS_RESOURCE_SCOPE_REPORTING_FALLBACK_REWRITE_FAILED'; end if;
  execute replaced;
end $rewrite$;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('reporting.exports.create','reporting','POST','/api/v1/reports/exports','1.0.0'),
  ('reporting.exports.read','reporting','GET','/api/v1/reports/exports/{exportid}','1.0.0');
insert into access.permission(id,code,risk,status) values
  ('permission:7315a948b7aaa952a11db85f','reporting.export.read','high','active'),
  ('permission:8bfc2e15e5cbd6b8c000bacc','reporting.export.manage','critical','active');
insert into capability.capability(id,kind,name,version,status) values
  ('reporting.exports.create','operation','reporting.exports.create',1,'active'),
  ('reporting.exports.read','operation','reporting.exports.read',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('reporting.exports.create','reporting.exports.create','reporting.export.manage','operator'),
  ('reporting.exports.read','reporting.exports.read','reporting.export.read','operator');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version) values
  ('platform:reporting.exports.create','organization-platform-root','reporting.exports.create','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:reporting.exports.read','organization-platform-root','reporting.exports.read','enabled',null,'1970-01-01T00:00:00Z',null,0);

insert into access.rolepermission(role_id,permission_id,effect)
  select distinct mapping.role_id,'permission:7315a948b7aaa952a11db85f','allow' from access.rolepermission mapping
  join access.permission permission on permission.id=mapping.permission_id where permission.code like 'reporting.%.read'
  on conflict do nothing;
insert into access.rolepermission(role_id,permission_id,effect)
  select distinct mapping.role_id,'permission:8bfc2e15e5cbd6b8c000bacc','allow' from access.rolepermission mapping
  join access.permission permission on permission.id=mapping.permission_id
  where permission.code in('order.export','finance.statement.export') on conflict do nothing;

insert into runtime.schemaversion(version,checksum) values('20260821048000','f519a4aed8dfb92dcaf6ac9584ea40ed1675b908c86d4e72e592092237c21f02');

do $assert$ begin
  if (select count(*) from runtime.operation)<>201 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if not exists(select 1 from pg_indexes where schemaname='reporting' and indexname='reporting_fact_scope_period') then
    raise exception 'REPORTING_QUERY_INDEX_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821048000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
