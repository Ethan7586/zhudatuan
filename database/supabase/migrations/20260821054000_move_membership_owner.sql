begin;

alter table member.membership set schema access;

update runtime.schemaversion set checksum='5de419de47e41b59539a99fcf0b9630857de014c937ef97178dddb08d4b0d640'
where version='20260821032000';
insert into runtime.schemaversion(version,checksum)
values('20260821054000','9f25b6db79235d926ba0cb9068108235d43275d30386301b288b162411a81a94');

do $assert$ begin
  if to_regclass('access.membership') is null then raise exception 'ACCESS_MEMBERSHIP_MISSING'; end if;
  if to_regclass('member.membership') is not null then raise exception 'MEMBER_MEMBERSHIP_COMPATIBILITY_REMAINS'; end if;
  if (select count(*) from runtime.operation)<>206 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
end $assert$;

commit;
