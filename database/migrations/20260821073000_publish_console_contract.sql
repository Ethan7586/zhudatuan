begin;

update runtime.schemaversion
set checksum='b4b1aae5aa73442ff58231904a3d6bd0627bfc8614f2d7e0698a7fb3f8d46093'
where version='20260821032000';

insert into runtime.schemaversion(version,checksum)
values('20260821073000','0e829689c463b661ed5050f11951fd02baebbd87600b6a83fb39f07008fd1557');

do $assert$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260821032000'
    and checksum='b4b1aae5aa73442ff58231904a3d6bd0627bfc8614f2d7e0698a7fb3f8d46093')
    then raise exception 'RUNTIME_CONTRACT_CHECKSUM_MISMATCH'; end if;
end $assert$;

commit;
