begin;
do $contract$ begin
  if (select count(*) from runtime.operation)<>274 or (select count(*) from capability.operation)<>274 then
    raise exception 'CONTRACT_V4_OPERATION_CATALOG_MISMATCH';
  end if;
  if (select count(*) from runtime.event)<>103 then raise exception 'CONTRACT_V4_EVENT_CATALOG_MISMATCH'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='4.0.0'
    and checksum='6a59888cfc18032dc6df9d173404c90791f80f733f46599fcde1a03952671661' and status='active') then
    raise exception 'CONTRACT_V4_IDENTITY_MISMATCH';
  end if;
  if exists(select 1 from runtime.operation where contract_version<>'4.0.0') then
    raise exception 'CONTRACT_V4_VERSION_DRIFT';
  end if;
  if exists(select 1 from runtime.errorcontract where contract_version<>'4.0.0') then
    raise exception 'CONTRACT_V4_ERROR_VERSION_DRIFT';
  end if;
end $contract$;
rollback;
