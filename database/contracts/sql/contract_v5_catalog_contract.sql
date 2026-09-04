begin;

do $contract$
begin
  if (select count(*) from runtime.operation)<>374 then raise exception 'CONTRACT_V5_OPERATION_CATALOG_MISMATCH'; end if;
  if (select count(*) from capability.operation)<>374 then raise exception 'CONTRACT_V5_CAPABILITY_BINDING_MISMATCH'; end if;
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
    where artifact='commerce' and version='5.0.0' and checksum='c803fc345485b155363790d399645dc9775f0627eaa463d0d29644f8e9878fbe'
      and operation_count=374 and event_count=145 and status='active'
  ) then raise exception 'CONTRACT_V5_IDENTITY_MISMATCH'; end if;
end
$contract$;

rollback;
