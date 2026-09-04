begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904030300') then raise exception 'RECONCILIATION_REVIEW_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904030400') then raise exception 'RECONCILIATION_REVIEW_ALREADY_APPLIED'; end if;
end
$precondition$;

create temporary table reconciliation_review_before on commit drop as
select (select count(*) from finance.reconciliation)::bigint reconciliations,
  (select coalesce(sum(abs(difference_minor)),0) from finance.reconciliation)::numeric difference_minor,
  (select count(*) from approval.instances)::bigint approvals;

alter table approval.templates drop constraint templates_subject_kind_check;
alter table approval.templates add constraint templates_subject_kind_check
  check(subject_kind in('voucherstock','voucherissue','financerepair','reconciliation','withdrawal','refund','experiencepublish','riskexception'));
alter table approval.template_versions drop constraint template_versions_subject_kind_check;
alter table approval.template_versions add constraint template_versions_subject_kind_check
  check(subject_kind in('voucherstock','voucherissue','financerepair','reconciliation','withdrawal','refund','experiencepublish','riskexception'));
alter table approval.instances drop constraint instances_subject_kind_check;
alter table approval.instances add constraint instances_subject_kind_check
  check(subject_kind in('voucherstock','voucherissue','financerepair','reconciliation','withdrawal','refund','experiencepublish','riskexception'));
alter table approval.proofs drop constraint proofs_subject_kind_check;
alter table approval.proofs add constraint proofs_subject_kind_check
  check(subject_kind in('voucherstock','voucherissue','financerepair','reconciliation','withdrawal','refund','experiencepublish','riskexception'));

alter table finance.reconciliation add column approval_instance_id text references approval.instances(id) deferrable initially deferred;
alter table finance.reconciliation add column review_route text;
alter table finance.reconciliation add constraint finance_reconciliation_review_route
  check(review_route is null or review_route in('automatic','approval'));
alter table finance.reconciliation add constraint finance_reconciliation_review_binding
  check((review_route is null and approval_instance_id is null)
    or (review_route='automatic' and approval_instance_id is null)
    or (review_route='approval' and approval_instance_id is not null));
create unique index finance_reconciliation_approval_instance on finance.reconciliation(approval_instance_id) where approval_instance_id is not null;

alter table finance.policy add constraint finance_threshold_policy_shape check(
  kind<>'threshold' or case
    when jsonb_typeof(rule->'amountMinor')='number' and (rule->>'amountMinor')~'^(0|[1-9][0-9]*)$'
      then (rule->>'amountMinor')::numeric<=9007199254740991
    else false
  end
) not valid;

select runtime.record_migration_evidence('20260904030400',before.rows_count,after.rows_count,before.minor,after.minor,
  'select conrelid::regclass,conname,convalidated from pg_constraint where conname in(''templates_subject_kind_check'',''template_versions_subject_kind_check'',''instances_subject_kind_check'',''proofs_subject_kind_check'',''finance_reconciliation_review_route'',''finance_reconciliation_review_binding'',''finance_threshold_policy_shape'') order by conrelid::regclass::text,conname;',
  'select id,state,review_route,approval_instance_id from finance.reconciliation where (review_route=''approval'')<>(approval_instance_id is not null);')
from (select reconciliations+approvals rows_count,difference_minor minor from reconciliation_review_before) before
cross join (select (select count(*) from finance.reconciliation)+(select count(*) from approval.instances) rows_count,
  (select coalesce(sum(abs(difference_minor)),0) from finance.reconciliation) minor) after;

insert into runtime.schemaversion(version,checksum)
values('20260904030400',encode(public.digest('20260904030400_route_reconciliation_reviews','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from pg_constraint where conname in(
    'templates_subject_kind_check','template_versions_subject_kind_check','instances_subject_kind_check','proofs_subject_kind_check',
    'finance_reconciliation_review_route','finance_reconciliation_review_binding','finance_threshold_policy_shape'))<>7 then
    raise exception 'RECONCILIATION_REVIEW_CONSTRAINTS_MISSING';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='finance' and indexname='finance_reconciliation_approval_instance') then
    raise exception 'RECONCILIATION_REVIEW_INDEX_MISSING';
  end if;
end
$assert$;

commit;
