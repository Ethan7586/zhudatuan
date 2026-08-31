begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831033000') then
    raise exception 'STOREFRONT_VOUCHER_BOUNDARY_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831034000') then
    raise exception 'STOREFRONT_VOUCHER_BOUNDARY_ALREADY_APPLIED';
  end if;
  if not exists(
    select 1 from capability.operation
    where operation_id='voucher.redemptions.read' and audience='storefront'
      and permission_code='voucher.redemption.read'
  ) then
    raise exception 'STOREFRONT_VOUCHER_REDEMPTION_CONTRACT_MISSING';
  end if;
end $precondition$;

select runtime.record_migration_evidence('20260831034000',1,1,0,0,
  'select operation_id,audience,permission_code from capability.operation where operation_id=''voucher.redemptions.read'';',
  'select membership.id,permission.permission_code,permission.effect from access.membership membership join lateral access.effective_permissions(membership.id) permission on permission.permission_code=''voucher.redemption.read'' where membership.client=''storefront'' order by membership.id;');

insert into runtime.schemaversion(version,checksum)
values('20260831034000','8549927b9f001e99e731f1be632151f576d42a301a6672377880e00e19063cac');

do $assert$ begin
  if (select count(*) from runtime.operation where id='voucher.redemptions.read')<>1
    or (select count(*) from capability.operation where operation_id='voucher.redemptions.read')<>1 then
    raise exception 'STOREFRONT_VOUCHER_REDEMPTION_REGISTRY_INVALID';
  end if;
end $assert$;

commit;
