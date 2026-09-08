begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:create-sfl-login-intents:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'SFL_LOGIN_INTENT_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260908011000'
        and checksum='e60f65ce0d94f0247e0945f174f624c29f4cf4c7aa07deadd3e8a7ad811c7dff')
    or exists(select 1 from runtime.schemaversion where version>'20260908011000') then
    raise exception 'SFL_LOGIN_INTENT_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

create table identity.loginintent(
  id text primary key,
  token_hash char(64) not null unique,
  source_realm_id text not null references identity.realm(id),
  source_node_id text not null,
  source_account_id text not null,
  source_session_id text not null,
  target_realm_id text not null references identity.realm(id),
  target_node_id text not null,
  target_surface text not null check(target_surface in('admin','consumer')),
  target_target text not null,
  target_application text,
  target_accounts_host text not null,
  target_return_origin text not null,
  target_account_id text,
  target_session_id text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null,
  foreign key(source_account_id,source_realm_id) references identity.account(id,realm_id),
  foreign key(source_session_id,source_account_id,source_realm_id)
    references identity.session(id,account_id,realm_id),
  foreign key(target_realm_id,target_target) references identity.realmtarget(realm_id,target),
  foreign key(target_session_id,target_account_id,target_realm_id)
    references identity.session(id,account_id,realm_id),
  check(id ~ '^loginintent:[a-z0-9-]{36}$'),
  check(source_realm_id<>target_realm_id and source_node_id<>target_node_id),
  check((target_account_id is null)=(target_session_id is null)),
  check((consumed_at is null)=(target_session_id is null)),
  check(target_accounts_host=lower(target_accounts_host) and target_accounts_host ~ '^[a-z0-9.-]+$'),
  check(target_return_origin ~ '^https://[a-z0-9.-]+(?::[0-9]+)?(?:/[^[:space:]]*)?$')
);
create index identity_loginintent_source_active_idx
  on identity.loginintent(source_realm_id,source_account_id,expires_at) where consumed_at is null;
create index identity_loginintent_target_active_idx
  on identity.loginintent(target_realm_id,expires_at) where consumed_at is null;

alter table identity.loginintent enable row level security;
revoke all on identity.loginintent from public;

create function identity.issue_login_intent(
  p_id text,
  p_token_hash text,
  p_source_session_id text,
  p_source_account_id text,
  p_source_realm_id text,
  p_target_node_id text,
  p_target_surface text,
  p_target_application text
)
returns table(
  target_realm_id text,
  target_accounts_host text,
  target_target text,
  target_application text,
  target_return_origin text
)
language sql volatile security definer
set search_path=identity,public,pg_temp
as $function$
  insert into identity.loginintent(
    id,token_hash,source_realm_id,source_node_id,source_account_id,source_session_id,
    target_realm_id,target_node_id,target_surface,target_target,target_application,
    target_accounts_host,target_return_origin,expires_at,created_at
  )
  select p_id,p_token_hash,source.realm_id,source_realm.node_id,source.account_id,source.id,
    target_realm.id,target_realm.node_id,target.surface,target.target,target.application_slug,
    entry.host,target.return_origin,clock_timestamp()+interval '5 minutes',clock_timestamp()
  from identity.session source
  join identity.realm source_realm on source_realm.id=source.realm_id and source_realm.status='active'
  join identity.realm target_realm on target_realm.node_id=p_target_node_id and target_realm.status='active'
  join identity.realmentry entry on entry.realm_id=target_realm.id and entry.kind='accounts' and entry.status='active'
  join identity.realmtarget target on target.realm_id=target_realm.id
    and target.surface=p_target_surface
    and target.application_slug is not distinct from p_target_application
  where source.id=p_source_session_id and source.account_id=p_source_account_id
    and source.realm_id=p_source_realm_id and source.revoked_at is null
    and source.expires_at>clock_timestamp() and source_realm.id<>target_realm.id
  returning loginintent.target_realm_id,loginintent.target_accounts_host,
    loginintent.target_target,loginintent.target_application,loginintent.target_return_origin
$function$;

create function identity.consume_login_intent(
  p_token_hash text,
  p_target_realm_id text,
  p_target_target text,
  p_target_application text,
  p_target_account_id text,
  p_target_session_id text
)
returns table(
  login_intent_id text,
  source_realm_id text,
  source_node_id text,
  source_account_id text,
  source_session_id text,
  target_node_id text
)
language sql volatile security definer
set search_path=identity,public,pg_temp
as $function$
  update identity.loginintent intent
  set consumed_at=clock_timestamp(),target_account_id=p_target_account_id,target_session_id=p_target_session_id
  from identity.session target_session
  where intent.token_hash=p_token_hash and intent.target_realm_id=p_target_realm_id
    and intent.target_target=p_target_target
    and intent.target_application is not distinct from p_target_application
    and intent.consumed_at is null and intent.expires_at>clock_timestamp()
    and target_session.id=p_target_session_id and target_session.account_id=p_target_account_id
    and target_session.realm_id=p_target_realm_id and target_session.auth_target=p_target_target
    and target_session.revoked_at is null and target_session.expires_at>clock_timestamp()
  returning intent.id,intent.source_realm_id,intent.source_node_id,
    intent.source_account_id,intent.source_session_id,intent.target_node_id
$function$;

revoke all on function identity.issue_login_intent(text,text,text,text,text,text,text,text) from public;
revoke all on function identity.consume_login_intent(text,text,text,text,text,text) from public;
grant execute on function identity.issue_login_intent(text,text,text,text,text,text,text,text)
  to shopapp,zhudatuanidentityapi;
grant execute on function identity.consume_login_intent(text,text,text,text,text,text)
  to shopapp,zhudatuanidentityapi;

insert into runtime.operation(id,owner,method,path,contract_version)
values('identity.loginintents.create','identity','POST','/api/v1/identity/login-intents','1.0.0');
insert into capability.capability(id,kind,name,version,status)
values('identity.loginintents.create','operation','identity.loginintents.create',1,'active');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:identity.loginintents.create','organization-platform-root','identity.loginintents.create',
  'enabled',null,'1970-01-01T00:00:00Z',null,0);
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('identity.loginintents.create','identity.loginintents.create','identity.session.read','member');

insert into runtime.schemaversion(version,checksum)
values('20260908012000','3e3750e6e2c705183d8611649c3937b1eceb7e28e8b795ff3c80e29c3bebab2e');

do $assert$
begin
  if to_regclass('identity.loginintent') is null
    or not has_function_privilege('shopapp','identity.issue_login_intent(text,text,text,text,text,text,text,text)','execute')
    or not has_function_privilege('zhudatuanidentityapi','identity.consume_login_intent(text,text,text,text,text,text)','execute')
    or has_table_privilege('shopapp','identity.loginintent','insert')
    or has_table_privilege('zhudatuanidentityapi','identity.loginintent','update')
    or not exists(select 1 from runtime.operation where id='identity.loginintents.create'
      and owner='identity' and method='POST' and path='/api/v1/identity/login-intents')
    or not exists(select 1 from capability.operation where operation_id='identity.loginintents.create'
      and permission_code='identity.session.read' and audience='member')
    or not exists(select 1 from runtime.schemaversion
      where version='20260908012000'
        and checksum='3e3750e6e2c705183d8611649c3937b1eceb7e28e8b795ff3c80e29c3bebab2e') then
    raise exception 'SFL_LOGIN_INTENT_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
