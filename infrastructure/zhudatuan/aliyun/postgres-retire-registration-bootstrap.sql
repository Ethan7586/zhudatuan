begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:registration-bootstrap-retirement:v1'));

do $retire$
declare
  authority oid := (select oid from pg_roles where rolname=current_user);
  rds_superuser oid := to_regrole('pg_rds_superuser');
  retired_role text;
  role_edge record;
begin
  if current_database()<>'zhudatuan_registration'
    or current_user in('shopmigration','zhudatuanbootstrap')
    or not (
      coalesce((select rolsuper from pg_roles where oid=authority),false)
      or coalesce(pg_has_role(authority,rds_superuser,'MEMBER'),false)
    ) then
    raise exception 'ZHUDATUAN_BOOTSTRAP_RETIREMENT_AUTHORITY_INVALID';
  end if;
  if (select count(*)
      from access.membership membership
      join access.membershiprole assignment on assignment.membership_id=membership.id
      where membership.client='operator' and membership.status='active'
        and assignment.role_id='role-platform-owner-v2'
        and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))<>1 then
    raise exception 'ZHUDATUAN_BOOTSTRAP_RETIREMENT_OWNER_INVARIANT_INVALID';
  end if;

  foreach retired_role in array array[
    'shopapp','shopmigration','shopread','zhudatuanbootstrap','zhudatuansandboxbootstrap'
  ] loop
    if to_regrole(retired_role) is null then
      raise exception 'ZHUDATUAN_BOOTSTRAP_RETIREMENT_ROLE_MISSING:%',retired_role;
    end if;
    execute format('alter role %I nologin password null nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls',retired_role);
  end loop;

  for role_edge in
    select granted.rolname granted_role,member.rolname member_role
    from pg_auth_members edge
    join pg_roles granted on granted.oid=edge.roleid
    join pg_roles member on member.oid=edge.member
    where granted.rolname=any(array[
      'shopapp','shopmigration','shopread','zhudatuanbootstrap','zhudatuansandboxbootstrap'
    ]) or member.rolname=any(array[
      'shopapp','shopmigration','shopread','zhudatuanbootstrap','zhudatuansandboxbootstrap'
    ])
  loop
    execute format('revoke %I from %I',role_edge.granted_role,role_edge.member_role);
  end loop;
end
$retire$;

revoke all privileges on all tables in schema identity,access,deployment from
  shopapp,shopmigration,shopread,zhudatuanbootstrap,zhudatuansandboxbootstrap;
revoke all privileges on all sequences in schema identity,access,deployment from
  shopapp,shopmigration,shopread,zhudatuanbootstrap,zhudatuansandboxbootstrap;
revoke all privileges on all functions in schema identity,access,deployment from
  shopapp,shopmigration,shopread,zhudatuanbootstrap,zhudatuansandboxbootstrap;
revoke usage on schema identity,access,deployment from
  shopapp,shopread,zhudatuanbootstrap,zhudatuansandboxbootstrap;
revoke usage on schema deployment from shopmigration;
grant usage on schema identity,access to shopmigration;
revoke execute on function deployment.registration_bootstrap_boundary(text) from shopmigration;
revoke execute on function deployment.is_independent_registration_database() from shopmigration;
revoke select on deployment.boundary from shopmigration;

do $assert_retired$
declare
  retired_roles constant text[] := array[
    'shopapp','shopmigration','shopread','zhudatuanbootstrap','zhudatuansandboxbootstrap'
  ];
  runtime_roles constant text[] := array['shopjob','zhudatuanidentityapi','zhudatuanidentityjob'];
  business_roles constant text[] := array['zhudatuanwebapi','zhudatuanpurchaseapi'];
  boundary_roles constant text[] := array['anon','authenticated','service_role','zhudatuanregistrationboundary'];
begin
  if (select count(*) from pg_roles where rolname=any(retired_roles))<>cardinality(retired_roles)
    or exists(select 1 from pg_roles where rolname=any(retired_roles)
      and (rolcanlogin or rolsuper or rolcreatedb or rolcreaterole
        or rolinherit or rolreplication or rolbypassrls)) then
    raise exception 'ZHUDATUAN_BOOTSTRAP_RETIREMENT_ROLE_INVALID';
  end if;
  if exists(select 1
    from pg_auth_members membership
    join pg_roles granted on granted.oid=membership.roleid
    join pg_roles member on member.oid=membership.member
    where granted.rolname=any(retired_roles) or member.rolname=any(retired_roles)) then
    raise exception 'ZHUDATUAN_BOOTSTRAP_RETIREMENT_MEMBERSHIP_REMAINS';
  end if;
  if (select count(*) from pg_roles where rolname=any(runtime_roles))<>cardinality(runtime_roles)
    or exists(select 1 from pg_roles where rolname=any(runtime_roles)
      and (not rolcanlogin or rolsuper or rolcreatedb or rolcreaterole
        or rolinherit or rolreplication or rolbypassrls)) then
    raise exception 'ZHUDATUAN_BOOTSTRAP_RETIREMENT_RUNTIME_ROLE_INVALID';
  end if;
  if (select count(*) from pg_roles where rolname=any(business_roles))<>cardinality(business_roles)
    or exists(select 1 from pg_roles where rolname=any(business_roles)
      and (not rolcanlogin or rolsuper or rolcreatedb or rolcreaterole
        or rolinherit or rolreplication or rolbypassrls))
    or exists(select 1 from pg_auth_members membership
      where membership.roleid in(select oid from pg_roles where rolname=any(business_roles))
        or membership.member in(select oid from pg_roles where rolname=any(business_roles))) then
    raise exception 'ZHUDATUAN_BOOTSTRAP_RETIREMENT_BUSINESS_ROLE_INVALID';
  end if;
  if (select count(*) from pg_roles where rolname=any(boundary_roles))<>cardinality(boundary_roles)
    or exists(select 1 from pg_roles where rolname=any(boundary_roles)
      and (rolcanlogin or rolsuper or rolcreatedb or rolcreaterole
        or rolinherit or rolreplication or rolbypassrls)) then
    raise exception 'ZHUDATUAN_BOOTSTRAP_RETIREMENT_BOUNDARY_ROLE_INVALID';
  end if;
  if has_schema_privilege('zhudatuanbootstrap','identity','USAGE')
    or has_schema_privilege('zhudatuanbootstrap','access','USAGE')
    or has_schema_privilege('zhudatuanbootstrap','deployment','USAGE')
    or not has_schema_privilege('shopmigration','identity','USAGE')
    or not has_schema_privilege('shopmigration','access','USAGE')
    or has_schema_privilege('shopmigration','deployment','USAGE')
    or has_function_privilege('zhudatuanbootstrap','deployment.registration_bootstrap_boundary(text)','EXECUTE')
    or has_function_privilege('shopmigration','deployment.registration_bootstrap_boundary(text)','EXECUTE')
    or has_function_privilege('shopmigration','deployment.is_independent_registration_database()','EXECUTE') then
    raise exception 'ZHUDATUAN_BOOTSTRAP_RETIREMENT_PRIVILEGE_REMAINS';
  end if;
  if (select pg_get_userbyid(datdba) from pg_database where datname=current_database())<>'shopmigration' then
    raise exception 'ZHUDATUAN_BOOTSTRAP_RETIREMENT_DATABASE_OWNER_INVALID';
  end if;
end
$assert_retired$;

commit;
