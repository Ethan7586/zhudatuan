begin;
do $contract$ begin
  if (select count(*) from runtime.operation)<>269 or (select count(*) from capability.operation)<>269 then
    raise exception 'CONTRACT_V3_OPERATION_CATALOG_MISMATCH';
  end if;
  if (select count(*) from runtime.event)<>97 then raise exception 'CONTRACT_V3_EVENT_CATALOG_MISMATCH'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0'
    and checksum='2d179f54b48381541fcc3df2b1b016742c901e12213816415b3f5e54f65d0285' and status='active') then
    raise exception 'CONTRACT_V3_IDENTITY_MISMATCH';
  end if;
  if exists(select 1 from runtime.operation where contract_version<>'3.0.0') then
    raise exception 'CONTRACT_V3_VERSION_DRIFT';
  end if;
end $contract$;
rollback;
