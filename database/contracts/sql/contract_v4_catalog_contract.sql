begin;
do $contract$ begin
  if (select count(*) from runtime.operation)<>275 or (select count(*) from capability.operation)<>275 then
    raise exception 'CONTRACT_V4_OPERATION_CATALOG_MISMATCH';
  end if;
  if (select count(*) from runtime.event)<>103 then raise exception 'CONTRACT_V4_EVENT_CATALOG_MISMATCH'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='4.0.0'
    and checksum='bbef05ea5f447e575590131054c0f391681002a9b4a20ab4c9f80364b155d436' and status='active') then
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
