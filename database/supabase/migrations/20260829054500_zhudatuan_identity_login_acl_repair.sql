begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:identity-login-acl-repair:v1'));

do $boundary_guard$
begin
  if not (
    (current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)
  ) then
    raise exception 'ZHUDATUAN_IDENTITY_LOGIN_ACL_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829040000'
      and checksum='77166f2dd111907cdf0910060362a3144e86a0606c884a3d77c8134b0743173a') then
    raise exception 'ZHUDATUAN_IDENTITY_LOGIN_ACL_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion
    where version>'20260829040000' and version<>'20260829054500') then
    raise exception 'ZHUDATUAN_IDENTITY_LOGIN_ACL_FUTURE_HEAD_INVALID';
  end if;
end
$boundary_guard$;

-- A successful password login clears the subject, account, network and device
-- failure counters after credential verification. The registration API role
-- already had SELECT/INSERT/UPDATE and an ALL RLS policy on loginattempt, but
-- lacked the table-level DELETE grant, causing the otherwise successful login
-- transaction to fail closed as INTERNAL_ERROR.
grant delete on identity.loginattempt to zhudatuanidentityapi;

insert into runtime.schemaversion(version,checksum)
values('20260829054500','624ce2aff8edc85f82d71d09db019b623199eeb4522017dca3f9d44ba3803df9')
on conflict(version) do nothing;

do $assert$
begin
  if exists(select 1 from (values
      ('runtime.idempotency','SELECT'),('runtime.idempotency','INSERT'),('runtime.idempotency','UPDATE'),
      ('identity.loginattempt','SELECT'),('identity.loginattempt','INSERT'),('identity.loginattempt','UPDATE'),('identity.loginattempt','DELETE'),
      ('identity.credential','SELECT'),('identity.credential','UPDATE'),
      ('identity.principal','SELECT'),('identity.principal','UPDATE'),
      ('member.profile','SELECT'),('access.membership','SELECT'),
      ('identity.assurance','SELECT'),
      ('identity.session','SELECT'),('identity.session','INSERT'),('identity.session','UPDATE'),
      ('identity.authticket','SELECT'),('identity.authticket','INSERT'),('identity.authticket','UPDATE'),
      ('runtime.outbox','INSERT'),('audit.record','SELECT'),('audit.record','INSERT'),
      ('audit.accessrecord','SELECT'),('audit.archiveref','SELECT')
    ) required(relation_name,privilege_name)
    where not has_table_privilege('zhudatuanidentityapi',required.relation_name,required.privilege_name)) then
    raise exception 'ZHUDATUAN_IDENTITY_LOGIN_ACL_REQUIRED_PRIVILEGE_MISSING';
  end if;
  if has_table_privilege('zhudatuanidentityapi','identity.loginattempt','TRUNCATE')
    or has_table_privilege('zhudatuanidentityapi','identity.loginattempt','REFERENCES')
    or has_table_privilege('zhudatuanidentityapi','identity.loginattempt','TRIGGER') then
    raise exception 'ZHUDATUAN_IDENTITY_LOGIN_ACL_EXCESS_PRIVILEGE';
  end if;
  if exists(select 1 from (values('identity'),('member'),('access'),('runtime'),('audit')) required(schema_name)
    where not has_schema_privilege('zhudatuanidentityapi',required.schema_name,'USAGE')) then
    raise exception 'ZHUDATUAN_IDENTITY_LOGIN_ACL_SCHEMA_USAGE_MISSING';
  end if;
  if not exists(select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='identity' and relation.relname='loginattempt' and relation.relrowsecurity) then
    raise exception 'ZHUDATUAN_IDENTITY_LOGIN_ACL_RLS_DISABLED';
  end if;
  if not exists(select 1 from pg_policies
    where schemaname='identity' and tablename='loginattempt' and policyname='zhudatuanidentityapi'
      and cmd='ALL' and 'zhudatuanidentityapi'=any(roles::text[])) then
    raise exception 'ZHUDATUAN_IDENTITY_LOGIN_ACL_POLICY_MISSING';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829054500'
      and checksum='624ce2aff8edc85f82d71d09db019b623199eeb4522017dca3f9d44ba3803df9') then
    raise exception 'ZHUDATUAN_IDENTITY_LOGIN_ACL_REPAIR_MISSING';
  end if;
end
$assert$;

commit;
