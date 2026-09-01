begin;
do $contract$ begin
  if (select count(*) from runtime.operation)<>269 or (select count(*) from capability.operation)<>269 then
    raise exception 'CONTRACT_V3_OPERATION_CATALOG_MISMATCH';
  end if;
  if (select count(*) from runtime.event)<>97 then raise exception 'CONTRACT_V3_EVENT_CATALOG_MISMATCH'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0'
    and checksum='a9846680ce3534a98a0e2c44b2050a0b3bb2c1fba3413da8675e757a922ccb8d' and status='active') then
    raise exception 'CONTRACT_V3_IDENTITY_MISMATCH';
  end if;
  if exists(select 1 from runtime.operation where contract_version<>'3.0.0') then
    raise exception 'CONTRACT_V3_VERSION_DRIFT';
  end if;
end $contract$;
rollback;
