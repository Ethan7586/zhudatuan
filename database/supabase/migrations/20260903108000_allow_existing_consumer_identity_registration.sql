begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:allow-existing-consumer-identity-registration:v1'));

do $precondition$
declare definition text;
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260903107000'
        and checksum='2f462b96c7fa8034051d4f8dc77a9391de6f8a12e07bd7a8d055769c07c8337d')
    or exists(select 1 from runtime.schemaversion where version>'20260903107000') then
    raise exception 'EXISTING_CONSUMER_REGISTRATION_PREDECESSOR_INVALID';
  end if;

  select pg_get_functiondef('access.protect_zhudatuan_registration_access_write()'::regprocedure)
  into definition;
  if regexp_count(definition,'credential\.created_at>=transaction_timestamp\(\)')<>1
    or regexp_count(definition,'profile\.created_at>=transaction_timestamp\(\)')<>1 then
    raise exception 'EXISTING_CONSUMER_REGISTRATION_LEGACY_BOUNDARY_INVALID';
  end if;
end
$precondition$;

do $rewrite$
declare
  definition text;
  rewritten text;
begin
  select pg_get_functiondef('access.protect_zhudatuan_registration_access_write()'::regprocedure)
  into definition;
  rewritten:=replace(definition,'and credential.created_at>=transaction_timestamp()','');
  rewritten:=replace(rewritten,'and profile.created_at>=transaction_timestamp()','');
  if rewritten=definition
    or position('credential.created_at>=transaction_timestamp()' in rewritten)>0
    or position('profile.created_at>=transaction_timestamp()' in rewritten)>0 then
    raise exception 'EXISTING_CONSUMER_REGISTRATION_BOUNDARY_REWRITE_FAILED';
  end if;
  execute rewritten;
end
$rewrite$;

insert into runtime.schemaversion(version,checksum)
values('20260903108000','ee6c3be60a29003bc3989be345d9083cf7b2002eb6b6af0b7d6af945f7eff884');

do $postcondition$
declare definition text;
begin
  select pg_get_functiondef('access.protect_zhudatuan_registration_access_write()'::regprocedure)
  into definition;
  if position('credential.created_at>=transaction_timestamp()' in definition)>0
    or position('profile.created_at>=transaction_timestamp()' in definition)>0
    or position('challenge.consumed_at>=transaction_timestamp()' in definition)=0
    or position('invite.accepted_at>=transaction_timestamp()' in definition)=0
    or not exists(select 1 from runtime.schemaversion
      where version='20260903108000'
        and checksum='ee6c3be60a29003bc3989be345d9083cf7b2002eb6b6af0b7d6af945f7eff884') then
    raise exception 'EXISTING_CONSUMER_REGISTRATION_BOUNDARY_INVALID';
  end if;
end
$postcondition$;

commit;
