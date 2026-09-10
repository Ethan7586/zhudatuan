begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904061000') then raise exception 'IDEAL_PROJECTION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904062000') then raise exception 'IDEAL_PROJECTION_ALREADY_APPLIED'; end if;
end
$precondition$;

create table reporting.clientprojection(
  id text primary key check(id~'^clientprojection:'),
  tenant_id text not null,
  scope_id text not null,
  target text not null check(target in('console','storefront','store','supplier','miniapp')),
  projection_kind text not null check(projection_kind='navigationoperation'),
  contract_version text not null check(contract_version='5.0.0'),
  watermark text not null,
  row_count bigint not null check(row_count>0),
  checksum char(64) not null check(checksum~'^[0-9a-f]{64}$'),
  payload_reference text not null,
  published_by text not null,
  published_at timestamptz not null,
  version bigint not null check(version>0),
  unique(scope_id,target,projection_kind,contract_version)
);
insert into reporting.clientprojection(
  id,tenant_id,scope_id,target,projection_kind,contract_version,watermark,row_count,checksum,payload_reference,published_by,published_at,version)
select 'clientprojection:'||target,'organization-platform-root','organization-platform-root',target,'navigationoperation','5.0.0',
  'contract:5.0.0',count(*),
  encode(public.digest(string_agg(operation.operation_id,chr(30) order by operation.operation_id),'sha256'),'hex'),
  'contract://clients/'||target||'/5.0.0','migration:projection',clock_timestamp(),1
from unnest(array['console','storefront','store','supplier','miniapp']) target
join capability.operation operation on target=any(operation.targets)
group by target;
alter table reporting.clientprojection enable row level security;
alter table reporting.clientprojection force row level security;
create policy migrationaccess on reporting.clientprojection for all to shopmigration using(true) with check(true);
create policy clientprojectionread on reporting.clientprojection for select to shopread,shopapp,shopjob using(true);
revoke all on reporting.clientprojection from public;
grant select on reporting.clientprojection to shopread,shopapp,shopjob;

select runtime.record_migration_evidence('20260904062000',5,(select count(*) from reporting.clientprojection),0,0,
  'select target,row_count,checksum,watermark,payload_reference from reporting.clientprojection order by target;',
  'select target,count(*) from capability.operation operation cross join unnest(operation.targets) target group by target order by target;');
insert into runtime.schemaversion(version,checksum)
values('20260904062000',encode(public.digest('20260904062000_publish_ideal_projections','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from reporting.clientprojection)<>5 then raise exception 'IDEAL_CLIENT_PROJECTION_COUNT_INVALID'; end if;
end
$assert$;

commit;
