begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904062000') then raise exception 'IDEAL_CONTRACT_RETIRE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904063000') then raise exception 'IDEAL_CONTRACT_RETIRE_ALREADY_APPLIED'; end if;
end
$precondition$;

create table runtime.retiredoperation(
  id text primary key,
  owner text not null,
  method text not null,
  path text not null,
  contract_version text not null,
  reason text not null,
  retired_by text not null,
  retired_at timestamptz not null
);
insert into runtime.retiredoperation(id,owner,method,path,contract_version,reason,retired_by,retired_at)
select id,owner,method,path,contract_version,'contractversionretired','migration:contract',clock_timestamp()
from runtime.operation where contract_version<>'5.0.0';
delete from runtime.operation where contract_version<>'5.0.0';
alter table runtime.retiredoperation enable row level security;
alter table runtime.retiredoperation force row level security;
create policy migrationaccess on runtime.retiredoperation for all to shopmigration using(true) with check(true);
create policy retiredoperationread on runtime.retiredoperation for select to shopread,shopjob using(true);
revoke all on runtime.retiredoperation from public,shopapp;
grant select on runtime.retiredoperation to shopread,shopjob;

select runtime.record_migration_evidence('20260904063000',
  (select operation_count from runtime.contractcatalog where artifact='commerce' and version='5.0.0'),
  (select count(*) from runtime.operation),0,0,
  'select id,owner,method,path,contract_version from runtime.operation order by id;',
  'select id,owner,method,path,contract_version,reason,retired_at from runtime.retiredoperation order by retired_at,id;');
insert into runtime.schemaversion(version,checksum)
values('20260904063000',encode(public.digest('20260904063000_retire_legacy_contract','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from runtime.operation where contract_version<>'5.0.0') then raise exception 'IDEAL_LEGACY_OPERATION_REMAINS'; end if;
  if exists(select 1 from runtime.contractcatalog where artifact='commerce' and status='active' and version<>'5.0.0')
    then raise exception 'IDEAL_LEGACY_CONTRACT_ACTIVE'; end if;
end
$assert$;

commit;
