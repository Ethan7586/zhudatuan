begin;

drop table if exists runtime.partneraddressstage;
drop table if exists runtime.distributorcontactstage;
drop table if exists runtime.wechatidentitystage;

do $block$ declare item record; begin
  -- Every public business table belongs to the retired model. DROP CASCADE is
  -- intentional inside the maintenance-window transaction: dependent legacy
  -- functions, triggers, policies and views must not survive as fallbacks.
  for item in select tablename from pg_tables where schemaname='public' order by tablename loop
    execute format('drop table public.%I cascade',item.tablename);
  end loop;
  for item in select c.relkind,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in('v','m','S') order by c.relname loop
    execute format('drop %s public.%I cascade',case item.relkind when 'v' then 'view' when 'm' then 'materialized view' else 'sequence' end,item.relname);
  end loop;
  for item in select p.oid::regprocedure identity from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'api\_%' escape '\' or p.proname like '%simulation%' or p.proname like 'test\_%' escape '\') loop
    execute format('drop routine %s cascade',item.identity);
  end loop;
end $block$;

drop table if exists inventory.commands,inventory.cutover_records,inventory.cutover_reviews,inventory.movements,inventory.observations,inventory.reservations,inventory.stock_items,inventory.sync_states cascade;

do $block$ declare item record; begin
  for item in select p.oid::regprocedure identity from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='inventory' loop execute format('drop routine %s cascade',item.identity); end loop;
end $block$;

drop table runtime.vouchersecretstage;

commit;
