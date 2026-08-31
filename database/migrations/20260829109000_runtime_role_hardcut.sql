begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829108000') then raise exception 'ROLE_HARDCUT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829109000') then raise exception 'ROLE_HARDCUT_ALREADY_APPLIED'; end if;
  if current_user not in('shopmigration') and not pg_has_role(current_user,'shopmigration','member') then
    raise exception 'ROLE_HARDCUT_MIGRATION_ROLE_REQUIRED';
  end if;
end $precondition$;

create temporary table role_reconcile on commit drop as
select count(*)::bigint rows,0::numeric minor from runtime.operation;

drop function if exists runtime.claim_identity_notification_job(text,integer,integer);
drop function if exists access.purchase_session_context(text,text,boolean) cascade;
drop function if exists access.web_member_scope(text,text) cascade;
drop function if exists access.web_storefront_scope(text,text) cascade;
drop function if exists benefit.web_account_balance(text,text) cascade;
drop function if exists benefit.web_ledger(text,text) cascade;
drop trigger if exists pricing_purchase_quote_immutable on pricing.quote;
drop function if exists pricing.purchase_quote_immutable() cascade;
drop schema if exists deployment cascade;

create function pricing.reject_quote_mutation() returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $function$
begin raise exception 'CHECKOUT_QUOTE_IMMUTABLE'; end $function$;
alter function pricing.reject_quote_mutation() owner to shopmigration;
revoke all on function pricing.reject_quote_mutation() from public;
create trigger pricing_quote_immutable before update or delete on pricing.quote
for each row execute function pricing.reject_quote_mutation();

create function ordering.protect_order_snapshot() returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $function$
begin
  if (new.id,new.order_number,new.scope_id,new.member_id,new.mall_id,new.checkout_id,new.currency,new.total_minor,new.evidence,
      new.address_snapshot,new.invoice_snapshot,new.delivery_snapshot,new.experience_version,new.created_at)
    is distinct from
    (old.id,old.order_number,old.scope_id,old.member_id,old.mall_id,old.checkout_id,old.currency,old.total_minor,old.evidence,
      old.address_snapshot,old.invoice_snapshot,old.delivery_snapshot,old.experience_version,old.created_at) then
    raise exception 'ORDER_SNAPSHOT_IMMUTABLE';
  end if;
  return new;
end $function$;
alter function ordering.protect_order_snapshot() owner to shopmigration;
revoke all on function ordering.protect_order_snapshot() from public;
create trigger ordering_orderrecord_snapshot before update on ordering.orderrecord
for each row execute function ordering.protect_order_snapshot();
create trigger ordering_line_immutable before update or delete on ordering.line
for each row execute function runtime.reject_receipt_mutation();

do $hardcut$
declare legacy text[]:=array['zhudatuanidentityapi','zhudatuanidentityjob','zhudatuanbootstrap','zhudatuanwebapi',
  'zhudatuanpurchaseapi','zhudatuansandboxbootstrap']; item record; role_name text;
begin
  for item in select schemaname,tablename,policyname from pg_policies
    where roles::text[]&&legacy loop
    execute format('drop policy if exists %I on %I.%I',item.policyname,item.schemaname,item.tablename);
  end loop;
  for item in select namespace.nspname schema_name,procedure.proname,
      pg_get_function_identity_arguments(procedure.oid) arguments
    from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace
    where procedure.prokind='f' and namespace.nspname not in('pg_catalog','information_schema')
      and pg_get_functiondef(procedure.oid)~'zhudatuan(identity|web|purchase|sandbox|bootstrap)' loop
    execute format('drop function if exists %I.%I(%s) cascade',item.schema_name,item.proname,item.arguments);
  end loop;
  foreach role_name in array legacy loop
    if exists(select 1 from pg_roles where rolname=role_name) then
      execute format('alter role %I nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls',role_name);
      execute format('drop owned by %I',role_name);
      execute format('drop role %I',role_name);
    end if;
  end loop;
end $hardcut$;

alter table runtime.migrationevidence add constraint runtime_migration_recovery_command
  check(recovery_sql~'^(select|begin;|update)') not valid;
alter table runtime.migrationevidence validate constraint runtime_migration_recovery_command;

select runtime.record_migration_evidence('20260829109000',(select rows from role_reconcile),(select count(*) from runtime.operation),0,0,
  'create index concurrently if not exists runtime_contractcatalog_active_live on runtime.contractcatalog(artifact,version) where status=''active'';',
  'select rolname from pg_roles where rolname in (''shopapp'',''shopjob'',''shopmigration'') order by rolname;');
insert into runtime.schemaversion(version,checksum)
values('20260829109000',encode(public.digest('20260829109000_runtime_role_hardcut','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from pg_roles where rolname in('zhudatuanidentityapi','zhudatuanidentityjob','zhudatuanbootstrap',
    'zhudatuanwebapi','zhudatuanpurchaseapi','zhudatuansandboxbootstrap')) then raise exception 'LEGACY_DATABASE_ROLE_REMAINS'; end if;
  if (select count(*) from pg_roles where rolname in('shopapp','shopjob','shopmigration'))<>3 then raise exception 'CANONICAL_DATABASE_ROLE_MISSING'; end if;
end $assert$;

commit;
