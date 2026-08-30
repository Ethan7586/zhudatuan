begin;

-- The Finance contract artifacts in this working tree already carry this
-- checksum. Publish the same authoritative head after the invitation data
-- model change so runtime startup never needs a compatibility bypass.
update runtime.schemaversion
set checksum='ad0fdd16d3a192b04d25732adb62841692fca5dfeda01b7aa24beea55c90a1bd'
where version='20260821032000';

insert into runtime.schemaversion(version,checksum)
values('20260829101000','6a01f83a511188525fca7d03e263f790736a39df27d0a6e543305ebdc83950ee');

do $assert$
begin
  if not exists(
    select 1 from runtime.schemaversion
    where version='20260821032000'
      and checksum='ad0fdd16d3a192b04d25732adb62841692fca5dfeda01b7aa24beea55c90a1bd'
  ) then raise exception 'RUNTIME_CONTRACT_CHECKSUM_MISMATCH'; end if;

  if (select count(*) from runtime.operation)<>(select count(*) from capability.operation)
    or not exists(select 1 from runtime.schemaversion where version='20260829101000')
  then raise exception 'TIERED_INVITATION_CONTRACT_RECONCILIATION_INCOMPLETE'; end if;
end
$assert$;

commit;
