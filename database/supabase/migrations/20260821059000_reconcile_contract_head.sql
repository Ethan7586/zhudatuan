begin;

update runtime.schemaversion
set checksum='6ada1cec97f6ad63842578d89453a04b88c95cf9f6fa33f320988b5150b8506a'
where version='20260821032000';

insert into runtime.schemaversion(version,checksum)
values('20260821059000','170f87b17820bd2d93089013411845035cbc2a7e1883a1bf888eb0d8a5d67a6d');

do $assert$ begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260821032000' and checksum='6ada1cec97f6ad63842578d89453a04b88c95cf9f6fa33f320988b5150b8506a')
  then raise exception 'RUNTIME_CONTRACT_CHECKSUM_MISMATCH'; end if;
end $assert$;

commit;
