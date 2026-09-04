begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903110000') then raise exception 'QUALIFICATION_ROLLBACK_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260903111000') then raise exception 'QUALIFICATION_ROLLBACK_ALREADY_APPLIED'; end if;
end
$precondition$;

alter table qualification.policyversion
  drop constraint policyversion_policy_id_rule_hash_key;

select runtime.record_migration_evidence('20260903111000',1,1,0,0,
  'select policy_id,version,rule_hash from qualification.policyversion order by policy_id,version desc limit 20;',
  'select conname from pg_constraint where conrelid=''qualification.policyversion''::regclass and conname=''policyversion_policy_id_rule_hash_key'';');
insert into runtime.schemaversion(version,checksum)
values('20260903111000',encode(public.digest('20260903111000_enable_qualification_rollback','sha256'),'hex'));

commit;
