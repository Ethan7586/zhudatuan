begin;

update runtime.schemaversion
set checksum='7ea9072c439fe292558912e1ac9e6c60da5a9a24408c02887286278b9af6b4d3'
where version='20260821032000';

insert into runtime.schemaversion(version,checksum)
values('20260821063000','d020ad23d35bda13705a2cc5638dc83cb01b51fb68957215bde3be95fcf3b72c');

do $assert$ begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260821032000' and checksum='7ea9072c439fe292558912e1ac9e6c60da5a9a24408c02887286278b9af6b4d3')
  then raise exception 'RUNTIME_ERROR_CONTRACT_CHECKSUM_MISMATCH'; end if;
end $assert$;

commit;
