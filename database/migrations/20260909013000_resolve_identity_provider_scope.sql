begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260909012000') then
    raise exception 'IDENTITY_PROVIDER_SCOPE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260909013000') then
    raise exception 'IDENTITY_PROVIDER_SCOPE_ALREADY_APPLIED';
  end if;
end
$precondition$;

do $scope$
declare
  source text;
  patched text;
begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into source;
  patched=replace(
    source,
    'elsif p_operation like ''identity.%'' then',
    'elsif p_operation in(''identity.providers.center.read'',''identity.providers.manage'',''identity.providers.test'') then
    if p_operation=''identity.providers.center.read'' and p_resource is not null then
      select id into resolved from organization.organization where id=p_resource;
    end if;
    if resolved is null then
      select organization_id into resolved from access.membership where id=p_membership_id;
    end if;
  elsif p_operation like ''identity.%'' then'
  );
  if patched=source then raise exception 'IDENTITY_PROVIDER_SCOPE_RULE_NOT_FOUND'; end if;
  execute patched;
end
$scope$;

revoke all on function access.resource_scope(text,text,text) from public;
grant execute on function access.resource_scope(text,text,text) to shopapp;

select runtime.record_migration_evidence(
  '20260909013000',
  (select count(*)*((select count(*) from organization.organization)+2)
    from access.membership where status='active' and client='operator'),
  (select count(*) from access.membership membership cross join organization.organization scope
    where membership.status='active' and membership.client='operator'
      and access.resource_scope('identity.providers.center.read',scope.id,membership.id)=scope.id)+
  (select count(*) from access.membership membership
    where membership.status='active' and membership.client='operator'
      and access.resource_scope('identity.providers.manage','00000000-0000-0000-0000-000000000000',membership.id)=membership.organization_id)+
  (select count(*) from access.membership membership
    where membership.status='active' and membership.client='operator'
      and access.resource_scope('identity.providers.test','00000000-0000-0000-0000-000000000000',membership.id)=membership.organization_id),
  0,0,
  'select membership.id,scope.id,access.resource_scope(''identity.providers.center.read'',scope.id,membership.id) resolved from access.membership membership cross join organization.organization scope where membership.status=''active'' and membership.client=''operator'' order by membership.id,scope.id;',
  'select id,organization_id,access.resource_scope(''identity.providers.manage'',''00000000-0000-0000-0000-000000000000'',id) manage_scope,access.resource_scope(''identity.providers.test'',''00000000-0000-0000-0000-000000000000'',id) test_scope from access.membership where status=''active'' and client=''operator'' order by id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260909013000',encode(public.digest('20260909013000_resolve_identity_provider_scope','sha256'),'hex'));
update runtime.schemahead set
  migration_head='20260909013000',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:identity',published_at=clock_timestamp()
where artifact='commerce';

do $assert$
declare definition text;
begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into definition;
  if definition not like '%identity.providers.center.read%identity.providers.manage%identity.providers.test%'
      or position('identity.providers.center.read' in definition)>position('identity.%' in definition) then
    raise exception 'IDENTITY_PROVIDER_SCOPE_BRANCH_INVALID';
  end if;
  if exists(
    select 1 from access.membership membership cross join organization.organization scope
    where membership.status='active' and membership.client='operator'
      and access.resource_scope('identity.providers.center.read',scope.id,membership.id) is distinct from scope.id
  ) then raise exception 'IDENTITY_PROVIDER_CENTER_SCOPE_INVALID'; end if;
  if exists(
    select 1 from access.membership membership
    where membership.status='active' and membership.client='operator'
      and (access.resource_scope('identity.providers.manage','00000000-0000-0000-0000-000000000000',membership.id) is distinct from membership.organization_id
        or access.resource_scope('identity.providers.test','00000000-0000-0000-0000-000000000000',membership.id) is distinct from membership.organization_id)
  ) then raise exception 'IDENTITY_PROVIDER_ACTION_SCOPE_INVALID'; end if;
  if exists(
    select 1 from access.membership membership
    where membership.status='active' and membership.client='operator'
      and access.resource_scope('identity.links.read',null,membership.id) not like 'self:%'
  ) then raise exception 'PERSONAL_IDENTITY_SCOPE_REGRESSED'; end if;
  if not has_function_privilege('shopapp','access.resource_scope(text,text,text)','EXECUTE') then
    raise exception 'IDENTITY_PROVIDER_SCOPE_PRIVILEGE_INVALID';
  end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce'
    and migration_head='20260909013000' and migration_count=(select count(*) from runtime.schemaversion)) then
    raise exception 'IDENTITY_PROVIDER_SCOPE_HEAD_INVALID';
  end if;
end
$assert$;

commit;
