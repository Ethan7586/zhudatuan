begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260902020000') then
    raise exception 'SUPPORT_ACCOUNT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902021000') then
    raise exception 'SUPPORT_ACCOUNT_ALREADY_APPLIED';
  end if;
end
$precondition$;

alter table support.account
  add column validation_state text,
  add column validation_code text,
  add column validated_at timestamptz,
  add column secret_version text;

update support.account
set validation_state=case when channel='inapp' then 'notrequired' else 'unverified' end,
    validation_code=case when channel='inapp' then 'SUPPORT_ACCOUNT_LOCAL' else 'SUPPORT_ACCOUNT_REVALIDATION_REQUIRED' end,
    validated_at=case when channel='inapp' then clock_timestamp() else null end,
    state=case when channel='inapp' then state else 'disabled' end,
    version=version+1;

alter table support.account
  alter column validation_state set not null,
  alter column validation_code set not null,
  add constraint support_account_validation_state check(validation_state in('verified','notrequired','unverified')),
  add constraint support_account_validation_code_shape check(length(validation_code) between 1 and 128),
  add constraint support_account_validation_shape check(
    (channel='inapp' and secret_ref is null and validation_state='notrequired' and validated_at is not null)
    or
    (channel<>'inapp' and validation_state='unverified')
    or
    (channel<>'inapp' and secret_ref is not null and validation_state='verified' and validated_at is not null and secret_version is not null)
  ),
  add constraint support_account_active_verified check(state='disabled' or validation_state in('verified','notrequired'));

select runtime.record_migration_evidence(
  '20260902021000',
  (select count(*) from support.account),
  (select count(*) from support.account where validation_state is not null and validation_code is not null),
  0,0,
  'create index concurrently if not exists support_account_validation_live on support.account(scope_id,validation_state,state,id);',
  'select scope_id,channel,state,validation_state,count(*) from support.account group by scope_id,channel,state,validation_state order by scope_id,channel,state,validation_state;'
);

insert into runtime.schemaversion(version,checksum)
values(
  '20260902021000',
  encode(public.digest('20260902021000_complete_support_account','sha256'),'hex')
);

do $assert$
begin
  if exists(
    select 1 from support.account
    where validation_state is null or validation_code is null
      or (state='active' and validation_state not in('verified','notrequired'))
      or (channel='inapp' and (secret_ref is not null or validation_state<>'notrequired' or validated_at is null))
  ) then raise exception 'SUPPORT_ACCOUNT_VALIDATION_SHAPE_INVALID'; end if;
  if not exists(
    select 1 from information_schema.columns
    where table_schema='support' and table_name='account' and column_name='secret_version'
  ) then raise exception 'SUPPORT_ACCOUNT_SECRET_VERSION_MISSING'; end if;
end
$assert$;

commit;
