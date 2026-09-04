begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904031300') then raise exception 'SUPPORT_SCAN_EXPLANATION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904031400') then raise exception 'SUPPORT_SCAN_EXPLANATION_ALREADY_APPLIED'; end if;
end
$precondition$;

create temporary table support_scan_before on commit drop as
select count(*) rows_count from support.evidence;

alter table support.evidence add column scan_recovery text;
update support.evidence set scan_reason=coalesce(scan_reason,'LEGACY_REJECTED'),scan_recovery='请重新选择安全文件后上传。' where state='rejected';
alter table support.evidence add constraint support_evidence_scan_explanation check(
  (state='rejected' and scan_reason is not null and scan_recovery is not null)
  or(state in('pending','clean') and scan_recovery is null)
);

select runtime.record_migration_evidence(
  '20260904031400',before.rows_count,after.rows_count,0,0,
  'select id,state,scan_reason,scan_recovery from support.evidence order by id;',
  'select state,count(*) from support.evidence group by state order by state;'
)
from support_scan_before before cross join(select count(*) rows_count from support.evidence) after;

insert into runtime.schemaversion(version,checksum)
values('20260904031400',encode(public.digest('20260904031400_explain_support_scan','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from support.evidence where state='rejected' and(scan_reason is null or scan_recovery is null)) then raise exception 'SUPPORT_SCAN_RECOVERY_MISSING'; end if;
  if exists(select 1 from support.evidence where state<>'rejected' and scan_recovery is not null) then raise exception 'SUPPORT_SCAN_RECOVERY_LEAK'; end if;
end
$assert$;

commit;
