begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904041000') then raise exception 'IDEAL_APPROVAL_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904042000') then raise exception 'IDEAL_APPROVAL_ALREADY_APPLIED'; end if;
  if (select count(*) from information_schema.tables where table_schema='approval' and table_name in(
    'templates','template_versions','instances','tasks','decisions','proofs'))<>6
  then raise exception 'IDEAL_APPROVAL_TABLES_MISSING'; end if;
end
$precondition$;

create index if not exists approval_task_active on approval.tasks(instance_id,sequence,state,id)
  include(assignee_kind,assignee,due_at,approval_count,minimum_approvals,version)
  where state in('pending','escalated');

select runtime.record_migration_evidence('20260904042000',
  (select count(*) from approval.instances),(select count(*) from approval.instances),0,0,
  'select subject_kind,state,count(*) from approval.instances group by subject_kind,state;',
  'select instance_id,sequence,state,count(*) from approval.tasks where state in(''pending'',''escalated'') group by instance_id,sequence,state;');
insert into runtime.schemaversion(version,checksum)
values('20260904042000',encode(public.digest('20260904042000_prepare_approval','sha256'),'hex'));

do $assert$
begin
  if exists(select scope_id,subject_kind,subject_id,subject_version,action from approval.instances
    where state='pending' group by scope_id,subject_kind,subject_id,subject_version,action having count(*)>1)
  then raise exception 'IDEAL_APPROVAL_ACTIVE_INSTANCE_DUPLICATE'; end if;
  if exists(select 1 from approval.proofs where (consumed_at is null)<>(consumed_by is null))
  then raise exception 'IDEAL_APPROVAL_PROOF_CONSUMPTION_INVALID'; end if;
end
$assert$;

commit;
