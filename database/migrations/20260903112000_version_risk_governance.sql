begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903111000') then raise exception 'RISK_GOVERNANCE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260903112000') then raise exception 'RISK_GOVERNANCE_ALREADY_APPLIED'; end if;
end
$precondition$;

alter table risk.policy
  add column version bigint not null default 1 check(version>0);

alter table risk.case
  add column version bigint not null default 1 check(version>0);

select runtime.record_migration_evidence('20260903112000',2,2,0,0,
  'select id,version,status from risk.policy order by id limit 20;',
  'select id,version,state from risk.case order by id limit 20;');
insert into runtime.schemaversion(version,checksum)
values('20260903112000',encode(public.digest('20260903112000_version_risk_governance','sha256'),'hex'));

commit;
