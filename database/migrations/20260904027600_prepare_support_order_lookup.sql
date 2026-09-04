begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904027500') then raise exception 'SUPPORT_ORDER_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904027600') then raise exception 'SUPPORT_ORDER_ALREADY_APPLIED'; end if;
end $precondition$;

create index support_conversation_order on support.conversation(scope_id,order_id,updated_at desc,id desc) where order_id is not null;

insert into runtime.schemaversion(version,checksum)
values('20260904027600',encode(public.digest('20260904027600_prepare_support_order_lookup','sha256'),'hex'));

do $assert$ begin
  if not exists(select 1 from pg_indexes where schemaname='support' and indexname='support_conversation_order')
    then raise exception 'SUPPORT_ORDER_LOOKUP_INDEX_MISSING'; end if;
end $assert$;

commit;
