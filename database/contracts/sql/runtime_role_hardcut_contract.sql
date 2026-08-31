begin;
do $contract$ begin
  if exists(select 1 from pg_roles where rolname in('zhudatuanidentityapi','zhudatuanidentityjob','zhudatuanbootstrap',
    'zhudatuanwebapi','zhudatuanpurchaseapi','zhudatuansandboxbootstrap')) then raise exception 'LEGACY_RUNTIME_ROLE_PRESENT'; end if;
  if (select count(*) from pg_roles where rolname in('shopapp','shopjob','shopmigration'))<>3 then raise exception 'CANONICAL_RUNTIME_ROLE_MISSING'; end if;
  if to_regprocedure('runtime.claim_identity_notification_job(text,integer,integer)') is not null then
    raise exception 'LEGACY_JOB_CLAIM_PATH_PRESENT';
  end if;
  if (select count(*) from pg_trigger where not tgisinternal and tgname in('pricing_quote_immutable','ordering_orderrecord_snapshot',
    'ordering_line_immutable'))<>3 then raise exception 'IMMUTABLE_CHECKOUT_FACT_TRIGGER_MISSING'; end if;
end $contract$;
rollback;
