begin;
do $contract$ begin
  if (select count(*) from runtime.operation)<>270 or (select count(*) from capability.operation)<>270 then
    raise exception 'CONTRACT_V3_OPERATION_CATALOG_MISMATCH';
  end if;
  if (select count(*) from runtime.event)<>97 then raise exception 'CONTRACT_V3_EVENT_CATALOG_MISMATCH'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0'
    and checksum='b6a6803d866fe082b61511eb434b3223e027162f805f47505745113624a96390' and status='active') then
    raise exception 'CONTRACT_V3_IDENTITY_MISMATCH';
  end if;
  if exists(select 1 from runtime.operation where contract_version<>'3.0.0') then
    raise exception 'CONTRACT_V3_VERSION_DRIFT';
  end if;
end $contract$;
rollback;
