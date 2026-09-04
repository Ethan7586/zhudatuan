begin;

update runtime.schemaversion
set checksum='7ea9072c439fe292558912e1ac9e6c60da5a9a24408c02887286278b9af6b4d3'
where version='20260821032000';

insert into runtime.schemaversion(version,checksum)
values('20260821062000','17a1e3a1d12d82c35e160559d6452961308a17a2d50c57d0c29b1ab9945f69b8');

do $assert$ begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260821032000' and checksum='7ea9072c439fe292558912e1ac9e6c60da5a9a24408c02887286278b9af6b4d3')
  then raise exception 'RUNTIME_ERROR_CONTRACT_CHECKSUM_MISMATCH'; end if;
end $assert$;

commit;
