begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831034000') then
    raise exception 'PERSONAL_VOUCHER_PERMISSION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831035000') then
    raise exception 'PERSONAL_VOUCHER_PERMISSION_ALREADY_APPLIED';
  end if;
  if not exists(select 1 from access.permission where code='voucher.redemption.read' and status='active') then
    raise exception 'PERSONAL_VOUCHER_PERMISSION_MISSING';
  end if;
end $precondition$;

select runtime.record_migration_evidence('20260831035000',1,1,0,0,
  'select id,code,status from access.permission where code=''voucher.redemption.read'';',
  'select membership.id,permission.effect from access.membership membership join lateral access.effective_permissions(membership.id) permission on permission.permission_code=''voucher.redemption.read'' where membership.client=''storefront'' order by membership.id;');

insert into runtime.schemaversion(version,checksum)
values('20260831035000','848ae95b92bde2a45498e83e442ed5832593d8571117324076517128c0fc01d0');

commit;
