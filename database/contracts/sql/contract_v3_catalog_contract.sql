begin;
do $contract$ begin
  if (select count(*) from runtime.operation)<>271 or (select count(*) from capability.operation)<>271 then
    raise exception 'CONTRACT_V3_OPERATION_CATALOG_MISMATCH';
  end if;
  if (select count(*) from runtime.event)<>97 then raise exception 'CONTRACT_V3_EVENT_CATALOG_MISMATCH'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0'
    and checksum='0fa65a88e13853d6db30740982d97f58ed37970de3f9c5d5f3e502ab87da38d7' and status='active') then
    raise exception 'CONTRACT_V3_IDENTITY_MISMATCH';
  end if;
  if exists(select 1 from runtime.operation where contract_version<>'3.0.0') then
    raise exception 'CONTRACT_V3_VERSION_DRIFT';
  end if;
end $contract$;
rollback;
