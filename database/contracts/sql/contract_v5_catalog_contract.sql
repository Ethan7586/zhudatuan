begin;

do $contract$
begin
  if (select count(*) from runtime.operation)<>381 then raise exception 'CONTRACT_V5_OPERATION_CATALOG_MISMATCH'; end if;
  if (select count(*) from capability.operation)<>381 then raise exception 'CONTRACT_V5_CAPABILITY_BINDING_MISMATCH'; end if;
  if (select count(*) from runtime.event where retired_at is null)<>145 then raise exception 'CONTRACT_V5_EVENT_CATALOG_MISMATCH'; end if;
  if not exists(select 1 from runtime.event where type='voucher.redeemed' and version=2 and owner='voucher' and retired_at is null)
    or exists(select 1 from runtime.event where type='voucher.redeemed' and version<>2 and retired_at is null) then
    raise exception 'CONTRACT_V5_VOUCHER_EVENT_VERSION_MISMATCH';
  end if;
  if exists(select 1 from runtime.operation where contract_version<>'5.0.0') then raise exception 'CONTRACT_V5_OPERATION_VERSION_MISMATCH'; end if;
  if exists(select 1 from runtime.operation where id='reporting.powderclass.read') then raise exception 'CONTRACT_V5_REMOVED_OPERATION_PRESENT'; end if;
  if exists(select 1 from access.permission where code='reporting.powderclass.read') then raise exception 'CONTRACT_V5_REMOVED_PERMISSION_PRESENT'; end if;
  if exists(select 1 from capability.capability where id='reporting.powderclass.read') then raise exception 'CONTRACT_V5_REMOVED_CAPABILITY_PRESENT'; end if;
  if exists(select 1 from reporting.metric where id='powderclass.amount') then raise exception 'CONTRACT_V5_REMOVED_METRIC_PRESENT'; end if;
  if not exists(select 1 from reporting.metric where id='category.amount') then raise exception 'CONTRACT_V5_CATEGORY_METRIC_MISSING'; end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='5.0.0' and checksum='799a9e1f552f4e0e2972498cd939627775883b557240c54440942e3d91ec7aa3'
      and operation_count=381 and event_count=145 and status='active'
  ) then raise exception 'CONTRACT_V5_IDENTITY_MISMATCH'; end if;
end
$contract$;

rollback;
