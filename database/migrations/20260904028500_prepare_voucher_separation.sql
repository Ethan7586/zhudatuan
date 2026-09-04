begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904028400') then raise exception 'VOUCHER_SEPARATION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904028500') then raise exception 'VOUCHER_SEPARATION_ALREADY_APPLIED'; end if;
end $precondition$;

-- Keep historical evidence, but never present or enforce a retired permission pair.
update access.separationrule set state='disabled',version=version+1,updated_at=clock_timestamp()
where left_permission='voucher.cardlibrary.create' and right_permission='voucher.issue' and state='active';

select runtime.record_migration_evidence('20260904028500',0,0,0,0,
  'select left_permission,right_permission,state from access.separationrule where left_permission like ''voucher.%'';',
  'select count(*) from access.separationrule where left_permission=''voucher.credential.manage'' and right_permission=''voucher.issue.manage'' and state=''active'';');
insert into runtime.schemaversion(version,checksum)
values('20260904028500',encode(public.digest('20260904028500_prepare_voucher_separation','sha256'),'hex'));

do $assert$ begin
  if not exists(select 1 from access.separationrule where left_permission='voucher.credential.manage' and right_permission='voucher.issue.manage' and state='active')
    or exists(select 1 from access.separationrule where left_permission='voucher.cardlibrary.create' and right_permission='voucher.issue' and state='active') then
    raise exception 'VOUCHER_SEPARATION_RULE_MISMATCH';
  end if;
end $assert$;

commit;
