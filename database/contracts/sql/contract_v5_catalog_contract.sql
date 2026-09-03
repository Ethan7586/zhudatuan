begin;

do $contract$
begin
  if (select count(*) from runtime.operation)<>275 then raise exception 'CONTRACT_V5_OPERATION_CATALOG_MISMATCH'; end if;
  if (select count(*) from capability.operation)<>275 then raise exception 'CONTRACT_V5_CAPABILITY_BINDING_MISMATCH'; end if;
  if (select count(*) from runtime.event)<>103 then raise exception 'CONTRACT_V5_EVENT_CATALOG_MISMATCH'; end if;
  if exists(select 1 from runtime.operation where contract_version<>'5.0.0') then raise exception 'CONTRACT_V5_OPERATION_VERSION_MISMATCH'; end if;
  if exists(select 1 from runtime.operation where id='reporting.powderclass.read') then raise exception 'CONTRACT_V5_REMOVED_OPERATION_PRESENT'; end if;
  if exists(select 1 from access.permission where code='reporting.powderclass.read') then raise exception 'CONTRACT_V5_REMOVED_PERMISSION_PRESENT'; end if;
  if exists(select 1 from capability.capability where id='reporting.powderclass.read') then raise exception 'CONTRACT_V5_REMOVED_CAPABILITY_PRESENT'; end if;
  if exists(select 1 from reporting.metric where id='powderclass.amount') then raise exception 'CONTRACT_V5_REMOVED_METRIC_PRESENT'; end if;
  if not exists(select 1 from reporting.metric where id='category.amount') then raise exception 'CONTRACT_V5_CATEGORY_METRIC_MISSING'; end if;
  if not exists(
    select 1 from runtime.contractcatalog
    where artifact='commerce' and version='5.0.0' and checksum='d21463e1526a44a08445f3a629bb41b2bb0bf0a03c6802a3d0137e592a12dead'
      and operation_count=275 and event_count=103 and status='active'
  ) then raise exception 'CONTRACT_V5_IDENTITY_MISMATCH'; end if;
end
$contract$;

rollback;
