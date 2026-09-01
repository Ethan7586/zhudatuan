begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831045000') then
    raise exception 'MEMBER_ADDRESS_MOVE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260901010000') then
    raise exception 'MEMBER_ADDRESS_MOVE_ALREADY_APPLIED';
  end if;
  if to_regclass('checkout.address') is null or to_regclass('member.address') is not null then
    raise exception 'MEMBER_ADDRESS_MOVE_STATE_INVALID';
  end if;
end $precondition$;

alter table checkout.address set schema member;
alter index member.checkout_address_member rename to member_address_member;

select runtime.record_migration_evidence('20260901010000',1,1,0,0,
  'select schemaname,tablename from pg_tables where schemaname=''checkout'' and tablename=''address'';',
  'select schemaname,tablename from pg_tables where schemaname=''member'' and tablename=''address'';');

insert into runtime.schemaversion(version,checksum)
values('20260901010000',encode(public.digest('20260901010000_move_address_to_member','sha256'),'hex'));

commit;
