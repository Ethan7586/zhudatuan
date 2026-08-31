begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:owner-personal-scope:v1'));

do $boundary_guard$
begin
  if not (
    (current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)
  ) then
    raise exception 'OWNER_PERSONAL_SCOPE_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829213000'
      and checksum='7250097cd72cfd86ac5dc381c84656245578b169b18fb7eec5044840b79dfce4') then
    raise exception 'OWNER_PERSONAL_SCOPE_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260829213000') then
    raise exception 'OWNER_PERSONAL_SCOPE_FUTURE_HEAD_INVALID';
  end if;
end
$boundary_guard$;

-- The stored Owner shape deliberately remains exactly Owner+self roles and
-- platform+tenant+self grants.  Derive the personal member scope from the
-- singleton Owner's canonical membership instead of adding a fourth mutable
-- authority row.  This makes the self role's owner-scoped permissions usable
-- by every current or future Owner without weakening platform scope semantics.
do $rewrite_owner_projection$
declare
  definition text;
  rewritten text;
  needle text:=$needle$), '[]'::jsonb)
  from access.membership membership where membership.id=p_membership_id
$needle$;
  replacement text:=$replacement$), '[]'::jsonb)
    || coalesce((select jsonb_build_array(jsonb_build_object(
      'scope',access.scope_object(membership.member_id),
      'permissions',coalesce((select jsonb_agg(permission.code order by permission.code)
        from access.rolepermission mapping
        join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
        where mapping.role_id='role:self' and mapping.effect='allow'),'[]'::jsonb),
      'effective',greatest(ownerassignment.effective_at,selfassignment.effective_at),
      'expires',null))
      from access.platformowner owner
      join access.membershiprole ownerassignment on ownerassignment.membership_id=owner.membership_id
        and ownerassignment.role_id='role-platform-owner-v2'
        and ownerassignment.effective_at<=clock_timestamp() and ownerassignment.expires_at is null
      join access.membershiprole selfassignment on selfassignment.membership_id=owner.membership_id
        and selfassignment.role_id='role:self'
        and selfassignment.effective_at<=clock_timestamp() and selfassignment.expires_at is null
      where owner.singleton=true and owner.state='active' and owner.membership_id=membership.id
        and not exists(select 1 from access.scopegrant ownerscope
          where ownerscope.membership_id=membership.id and ownerscope.scope_kind='owner'
            and ownerscope.effect='allow' and ownerscope.access_version>0
            and ownerscope.access_version<=membership.access_version
            and ownerscope.effective_at<=clock_timestamp()
            and (ownerscope.expires_at is null or ownerscope.expires_at>clock_timestamp()))), '[]'::jsonb)
  from access.membership membership where membership.id=p_membership_id
$replacement$;
begin
  select pg_get_functiondef('access.resolve_membership(text)'::regprocedure) into definition;
  rewritten:=replace(definition,needle,replacement);
  if rewritten=definition or position(replacement in rewritten)=0 then
    raise exception 'OWNER_PERSONAL_SCOPE_PROJECTION_REWRITE_FAILED';
  end if;
  execute rewritten;
end
$rewrite_owner_projection$;

-- The latest resolver inherited an old member-like exception list from before
-- invoice reads and commands became Operator operations.  Member-audience
-- profile reads/request creates stay personal; Operator list reads resolve to
-- the membership organization and concrete commands resolve from the target.
do $rewrite_invoice_scope$
declare
  definition text;
  rewritten text;
  old_list text:=$old$      'order.orders.create','order.aftersales.apply','payment.intents.create','benefit.accounts.read','invoice.profiles.manage',
      'invoice.requests.create','invoice.requests.read','invoice.requests.cancel',
$old$;
  member_list text:=$member$      'order.orders.create','order.aftersales.apply','payment.intents.create','benefit.accounts.read',
      'invoice.requests.create',
$member$;
  audience_branch text:=$branch$  elsif exists(select 1 from capability.operation where operation_id=p_operation and audience='member')
$branch$;
  operator_profile_branch text:=$profile$  elsif p_operation='invoice.profiles.manage' then
    select owner_id into resolved from invoice.profile where id=p_resource;
    if resolved is null then
      select organization_id into resolved from access.membership where id=p_membership_id;
    end if;
  elsif exists(select 1 from capability.operation where operation_id=p_operation and audience='member')
$profile$;
begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into definition;
  rewritten:=replace(definition,old_list,member_list);
  rewritten:=replace(rewritten,audience_branch,operator_profile_branch);
  if rewritten=definition
    or position(old_list in rewritten)>0
    or position(operator_profile_branch in rewritten)=0 then
    raise exception 'INVOICE_OPERATION_SCOPE_REWRITE_FAILED';
  end if;
  execute rewritten;
end
$rewrite_invoice_scope$;

insert into runtime.schemaversion(version,checksum)
values('20260829214000','98d43cc45c7c4ca510e3f917191fd751672c4846279d48bc37bbd9688a090fb4');

do $assert$
declare
  membership_id text;
  member_id text;
  organization_id text;
  fixture_profile constant text:='invoice-profile:owner-scope-assert';
begin
  if exists(select 1 from access.platformowner owner where owner.singleton=true and owner.state='active')
    and not exists(
      select 1
      from access.platformowner owner
      join access.membership membership on membership.id=owner.membership_id
      cross join lateral access.resolve_membership(owner.membership_id) resolved
      cross join lateral jsonb_array_elements(resolved.grants) grantrow
      where owner.singleton=true and owner.state='active'
        and grantrow->'scope'->>'kind'='owner'
        and grantrow->'scope'->>'id'=membership.member_id
        and (grantrow->'permissions')?'member.profile.read'
        and (grantrow->'permissions')?'member.address.read'
        and (grantrow->'permissions')?'member.address.manage'
    ) then
    raise exception 'OWNER_PERSONAL_SCOPE_PROJECTION_INVALID';
  end if;

  select membership.id,membership.member_id,membership.organization_id
  into membership_id,member_id,organization_id
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id and profile.status='active'
  where membership.status='active'
  order by (membership.client='operator') desc,membership.id
  limit 1;

  if membership_id is not null then
    if access.resource_scope('invoice.profiles.read',null,membership_id) is distinct from member_id
      or access.resource_scope('invoice.requests.create',null,membership_id) is distinct from member_id
      or access.resource_scope('invoice.requests.read',null,membership_id) is distinct from organization_id
      or access.resource_scope('invoice.profiles.manage','invoice-profile:not-created',membership_id)
        is distinct from organization_id then
      raise exception 'INVOICE_AUDIENCE_SCOPE_INVALID';
    end if;

    insert into invoice.profile(id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_token,
      taxid_key_version,status,version)
    values(fixture_profile,organization_id,'fixture','fixture','fixture',repeat('0',64),'fixture','active',0);
    if access.resource_scope('invoice.profiles.manage',fixture_profile,membership_id) is distinct from organization_id then
      raise exception 'INVOICE_CONCRETE_RESOURCE_SCOPE_INVALID';
    end if;

    delete from invoice.profile where id=fixture_profile;
  end if;

  if not exists(select 1 from runtime.schemaversion
    where version='20260829214000'
      and checksum='98d43cc45c7c4ca510e3f917191fd751672c4846279d48bc37bbd9688a090fb4') then
    raise exception 'OWNER_PERSONAL_SCOPE_SCHEMA_VERSION_INVALID';
  end if;
end
$assert$;

commit;
