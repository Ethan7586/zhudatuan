begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904028200') then
    raise exception 'TASK_AUTHORIZATION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260904028300') then
    raise exception 'TASK_AUTHORIZATION_ALREADY_APPLIED';
  end if;
end $precondition$;

-- Reuse Access's authoritative, read-only SECURITY DEFINER projection. Jobs must
-- not read Identity/Access tables directly or reuse a stale HTTP authorization.
grant execute on function access.authorization_snapshot(text,text,text,text) to shopjob;

select runtime.record_migration_evidence('20260904028300',0,0,0,0,
  'select has_function_privilege(''shopjob'',''access.authorization_snapshot(text,text,text,text)'',''execute'');',
  'select count(*) from runtime.schemaversion where version=''20260904028300'';');
insert into runtime.schemaversion(version,checksum)
values('20260904028300',encode(public.digest('20260904028300_prepare_task_authorization','sha256'),'hex'));

do $assert$ begin
  if not has_function_privilege('shopjob','access.authorization_snapshot(text,text,text,text)','execute') then
    raise exception 'TASK_AUTHORIZATION_JOB_GRANT_MISSING';
  end if;
end $assert$;

commit;
