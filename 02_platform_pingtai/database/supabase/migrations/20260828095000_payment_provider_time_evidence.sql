begin;

-- Provider effect time is an accounting fact, while completed_at historically
-- mixed provider time with the local worker clock. Legacy rows remain explicitly
-- unavailable (all three columns null); newly observed effects are sealed with a
-- canonical JSONB digest and their authoritative provider occurrence instant.
alter table payment.attempt
  add column provider_occurred_at timestamptz,
  add column provider_effect jsonb,
  add column provider_effect_hash char(64);
alter table payment.capture
  add column provider_occurred_at timestamptz,
  add column provider_effect jsonb,
  add column provider_effect_hash char(64);
alter table payment.providerattempt
  add column provider_occurred_at timestamptz,
  add column provider_effect jsonb,
  add column provider_effect_hash char(64);
alter table payment.observation
  add column provider_occurred_at timestamptz,
  add column provider_effect jsonb,
  add column provider_effect_hash char(64);

alter table payment.attempt add constraint payment_attempt_provider_effect
  check(
    (provider_occurred_at is null and provider_effect is null and provider_effect_hash is null)
    or(
      provider_occurred_at is not null and provider_effect is not null and provider_effect_hash is not null
      and completed_at=provider_occurred_at and state='succeeded' and external_transaction is not null
      and jsonb_typeof(provider_effect)='object' and pg_column_size(provider_effect)<=16384
      and coalesce(provider_effect->>'version','')='1' and coalesce(provider_effect->>'provider','')=provider
      and coalesce(provider_effect->>'kind','')='payment.capture'
      and coalesce(provider_effect->>'transaction','')=external_transaction
      and case when provider_effect ? 'occurredAt'
        then (provider_effect->>'occurredAt')::timestamptz=provider_occurred_at else false end
      and provider_effect_hash=encode(public.digest(provider_effect::text,'sha256'),'hex')
    )
  );
alter table payment.capture add constraint payment_capture_provider_effect
  check(
    (provider_occurred_at is null and provider_effect is null and provider_effect_hash is null)
    or(
      provider_occurred_at is not null and provider_effect is not null and provider_effect_hash is not null
      and completed_at=provider_occurred_at and state='succeeded'
      and jsonb_typeof(provider_effect)='object' and pg_column_size(provider_effect)<=16384
      and coalesce(provider_effect->>'version','')='1' and coalesce(provider_effect->>'provider','')<>''
      and coalesce(provider_effect->>'kind','')='payment.capture'
      and coalesce(provider_effect->>'order','')=order_id
      and coalesce(provider_effect->>'aggregateAmountMinor','')=amount_minor::text
      and coalesce(provider_effect->>'currency','')=currency
      and case when provider_effect ? 'occurredAt'
        then (provider_effect->>'occurredAt')::timestamptz=provider_occurred_at else false end
      and provider_effect_hash=encode(public.digest(provider_effect::text,'sha256'),'hex')
    )
  );
alter table payment.providerattempt add constraint payment_providerattempt_provider_effect
  check(
    (provider_occurred_at is null and provider_effect is null and provider_effect_hash is null)
    or(
      provider_occurred_at is not null and provider_effect is not null and provider_effect_hash is not null
      and completed_at=provider_occurred_at and outcome='succeeded' and provider_state='succeeded' and provider_reference is not null
      and jsonb_typeof(provider_effect)='object' and pg_column_size(provider_effect)<=16384
      and coalesce(provider_effect->>'version','')='1' and coalesce(provider_effect->>'provider','')<>''
      and coalesce(provider_effect->>'kind','')='payment.refund'
      and coalesce(provider_effect->>'refund','')=refund_id
      and coalesce(provider_effect->>'reference','')=provider_reference
      and case when provider_effect ? 'occurredAt'
        then (provider_effect->>'occurredAt')::timestamptz=provider_occurred_at else false end
      and provider_effect_hash=encode(public.digest(provider_effect::text,'sha256'),'hex')
    )
  );
alter table payment.observation add constraint payment_observation_provider_effect
  check(
    (provider_occurred_at is null and provider_effect is null and provider_effect_hash is null)
    or(
      provider_occurred_at is not null and provider_effect is not null and provider_effect_hash is not null
      and jsonb_typeof(provider_effect)='object' and pg_column_size(provider_effect)<=16384
      and coalesce(provider_effect->>'version','')='1' and coalesce(provider_effect->>'provider','')<>''
      and coalesce(provider_effect->>'amountMinor','')=amount_minor::text
      and coalesce(provider_effect->>'currency','')=currency
      and case when provider_effect ? 'occurredAt'
        then (provider_effect->>'occurredAt')::timestamptz=provider_occurred_at else false end
      and provider_effect_hash=encode(public.digest(provider_effect::text,'sha256'),'hex')
    )
  );

create or replace function payment.reject_provider_effect_mutation()
returns trigger language plpgsql set search_path=payment,pg_temp as $function$
begin
  if old.provider_effect_hash is null then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' then raise exception 'PAYMENT_PROVIDER_EFFECT_IMMUTABLE'; end if;
  if (new.provider_occurred_at,new.provider_effect,new.provider_effect_hash)
      is distinct from (old.provider_occurred_at,old.provider_effect,old.provider_effect_hash)
  then raise exception 'PAYMENT_PROVIDER_EFFECT_IMMUTABLE'; end if;
  return new;
end $function$;

create trigger payment_attempt_provider_effect_immutable before update or delete on payment.attempt
for each row execute function payment.reject_provider_effect_mutation();
create trigger payment_capture_provider_effect_immutable before update or delete on payment.capture
for each row execute function payment.reject_provider_effect_mutation();
create trigger payment_providerattempt_provider_effect_immutable before update or delete on payment.providerattempt
for each row execute function payment.reject_provider_effect_mutation();
create trigger payment_observation_provider_effect_immutable before update or delete on payment.observation
for each row execute function payment.reject_provider_effect_mutation();

insert into runtime.schemaversion(version,checksum)
values('20260828095000','aa9f6338cbad81ac43b31dcdcabab292861cbc982b14644b9ec14a449f0218c7');

do $assert$
begin
  if not exists(select 1 from information_schema.columns where table_schema='payment'
      and table_name='attempt' and column_name='provider_occurred_at')
    or not exists(select 1 from information_schema.columns where table_schema='payment'
      and table_name='capture' and column_name='provider_effect_hash')
    or not exists(select 1 from information_schema.columns where table_schema='payment'
      and table_name='providerattempt' and column_name='provider_effect')
    or not exists(select 1 from information_schema.columns where table_schema='payment'
      and table_name='observation' and column_name='provider_occurred_at')
  then raise exception 'PAYMENT_PROVIDER_EFFECT_COLUMNS_MISSING'; end if;
  if not exists(select 1 from pg_trigger where tgname='payment_attempt_provider_effect_immutable' and not tgisinternal)
    or not exists(select 1 from pg_trigger where tgname='payment_capture_provider_effect_immutable' and not tgisinternal)
    or not exists(select 1 from pg_trigger where tgname='payment_providerattempt_provider_effect_immutable' and not tgisinternal)
    or not exists(select 1 from pg_trigger where tgname='payment_observation_provider_effect_immutable' and not tgisinternal)
  then raise exception 'PAYMENT_PROVIDER_EFFECT_GUARD_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260828095000')
  then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
