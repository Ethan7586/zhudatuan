begin;
do $contract$ begin
  if (select count(*) from runtime.operation)<>272 or (select count(*) from capability.operation)<>272 then
    raise exception 'CONTRACT_V3_OPERATION_CATALOG_MISMATCH';
  end if;
  if (select count(*) from runtime.event)<>97 then raise exception 'CONTRACT_V3_EVENT_CATALOG_MISMATCH'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0'
    and checksum='73f5a4cee3d961c6ab72aa92bfbc3c1ba688c3427a5d01b2017347f24ca6ad95' and status='active') then
    raise exception 'CONTRACT_V3_IDENTITY_MISMATCH';
  end if;
  if exists(select 1 from runtime.operation where contract_version<>'3.0.0') then
    raise exception 'CONTRACT_V3_VERSION_DRIFT';
  end if;
end $contract$;
rollback;
