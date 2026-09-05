begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:access-identity-scope-assignments:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'ACCESS_IDENTITY_SCOPE_ASSIGNMENTS_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260901070000'
      and checksum='f00c95f5eb787b621b6ef72468611ba6827523aaf622beae06935b3f9af9059f') then
    raise exception 'ACCESS_IDENTITY_SCOPE_ASSIGNMENTS_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260901070000') then
    raise exception 'ACCESS_IDENTITY_SCOPE_ASSIGNMENTS_FUTURE_HEAD_INVALID';
  end if;
  if to_regclass('access.membershiprole') is null
    or to_regprocedure('access.resolve_membership(text)') is null then
    raise exception 'ACCESS_IDENTITY_SCOPE_ASSIGNMENTS_TARGET_MISSING';
  end if;
  if exists(select 1 from information_schema.columns
    where table_schema='access' and table_name='membershiprole'
      and column_name in('assigned_scope_kind','assigned_scope_id','assigned_scope_path','scope_source')) then
    raise exception 'ACCESS_IDENTITY_SCOPE_ASSIGNMENTS_STATE_INVALID';
  end if;
end
$precondition$;

alter table access.membershiprole
  add column assigned_scope_kind text,
  add column assigned_scope_id text,
  add column assigned_scope_path text,
  add column scope_source text;

update access.membershiprole assignment
set assigned_scope_kind=(access.scope_object(role.scope_id)->>'kind'),
    assigned_scope_id=role.scope_id,
    assigned_scope_path=coalesce((
      select string_agg(closure.ancestor_id,'/' order by closure.depth desc)
      from organization.unitclosure closure where closure.descendant_id=role.scope_id
    ),role.scope_id),
    scope_source='inherited'
from access.role role
where role.id=assignment.role_id
  and role.id not in('role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator')
  and assignment.assigned_scope_id is null;

create or replace function access.resolve_membership(p_membership_id text)
returns table(id text,active boolean,access_version bigint,denies text[],grants jsonb)
language sql stable security definer
set search_path=access,member,organization,pg_temp as $function$
  select membership.id,membership.status='active',membership.access_version,
    coalesce((select array_agg(distinct denied.code order by denied.code) from (
      select permission.code
      from access.membershiprole assignment
      join access.role role on role.id=assignment.role_id and role.status='active'
      join access.rolepermission mapping on mapping.role_id=role.id and mapping.effect='deny'
      join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
      where assignment.membership_id=membership.id
        and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
        and (role.id='role:self' or role.scope_id=membership.organization_id or exists(
          select 1 from organization.unitclosure closure
          where closure.ancestor_id=role.scope_id and closure.descendant_id=membership.organization_id))
      union
      select permission.code
      from access.membershipoverride overridepermission
      join access.permission permission on permission.id=overridepermission.permission_id and permission.status='active'
      where overridepermission.membership_id=membership.id and overridepermission.effect='deny'
        and overridepermission.revoked_at is null
        and overridepermission.effective_at<=clock_timestamp()
        and (overridepermission.expires_at is null or overridepermission.expires_at>clock_timestamp())
    ) denied),array[]::text[]),
    coalesce((select jsonb_agg(jsonb_build_object(
      'scope',access.scope_object(scopegrant.scope_id),
      'permissions',coalesce((select jsonb_agg(distinct allowed.code order by allowed.code) from (
          select permission.code
          from access.membershiprole assignment
          join access.role role on role.id=assignment.role_id and role.status='active'
          join access.rolepermission mapping on mapping.role_id=role.id and mapping.effect='allow'
          join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
          where assignment.membership_id=membership.id
            and assignment.effective_at<=clock_timestamp()
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
            and (
              (role.id='role:self' and scopegrant.scope_kind in('self','owner'))
              or (role.id='role-platform-owner-v2'
                and (
                  exists(select 1 from access.platformowner owner where owner.singleton=true
                    and owner.state='active' and owner.membership_id=membership.id)
                  or (
                    session_user='zhudatuanbootstrap'
                    and exists(select 1 from access.platformowner owner
                      where owner.singleton=true and owner.state='bootstrap_pending'
                        and owner.membership_id is null)
                    and membership.id='membership-platform-owner-ethan-v1'
                    and (select count(*) from access.membershiprole ownerassignment
                      where ownerassignment.role_id='role-platform-owner-v2'
                        and ownerassignment.effective_at<=clock_timestamp()
                        and (ownerassignment.expires_at is null
                          or ownerassignment.expires_at>clock_timestamp()))=1
                  )
                )
                and scopegrant.scope_kind='platform' and scopegrant.scope_id='organization-platform-root')
              or (role.id in('role-platform-owner-v2','role-platform-owner-successor-v1')
                and scopegrant.scope_kind='self'
                and scopegrant.scope_id=(select 'self:'||profile.principal_id from member.profile profile
                  where profile.id=membership.member_id)
                and permission.code in('access.ownership.read','access.ownership.transfer','access.ownership.accept')
                and ((role.id='role-platform-owner-v2' and exists(select 1 from access.platformowner owner
                    where owner.singleton=true and owner.state='active' and owner.membership_id=membership.id))
                  or (role.id='role-platform-owner-successor-v1' and permission.code<>'access.ownership.transfer')))
              or (role.id not in('role-platform-owner-v2','role-platform-owner-successor-v1')
                and (role.scope_id=membership.organization_id or exists(
                select 1 from organization.unitclosure closure
                where closure.ancestor_id=role.scope_id and closure.descendant_id=membership.organization_id))
                and (role.scope_id=scopegrant.scope_id or exists(
                  select 1 from organization.unitclosure closure
                  where closure.ancestor_id=role.scope_id and closure.descendant_id=scopegrant.scope_id))
                and (assignment.assigned_scope_id is null
                  or assignment.assigned_scope_id=scopegrant.scope_id
                  or exists(select 1 from organization.unitclosure assignedboundary
                    where assignedboundary.ancestor_id=assignment.assigned_scope_id
                      and assignedboundary.descendant_id=scopegrant.scope_id)))
            )
          union
          select permission.code
          from access.membershipoverride overridepermission
          join access.permission permission on permission.id=overridepermission.permission_id and permission.status='active'
          where overridepermission.membership_id=membership.id and overridepermission.effect='allow'
            and overridepermission.revoked_at is null
            and overridepermission.effective_at<=clock_timestamp()
            and (overridepermission.expires_at is null or overridepermission.expires_at>clock_timestamp())
        ) allowed), '[]'::jsonb),
      'effective',scopegrant.effective_at,'expires',scopegrant.expires_at) order by scopegrant.scope_path)
      from access.scopegrant scopegrant
      where scopegrant.membership_id=membership.id and scopegrant.effect='allow'
        and scopegrant.access_version>0 and scopegrant.access_version<=membership.access_version
        and scopegrant.effective_at<=clock_timestamp()
        and (scopegrant.expires_at is null or scopegrant.expires_at>clock_timestamp())), '[]'::jsonb)
  from access.membership membership where membership.id=p_membership_id
$function$;

grant execute on function access.resolve_membership(text) to shopapp,zhudatuanidentityapi;

insert into runtime.schemaversion(version,checksum)
values('20260901100000','78d8bc0b3efd7f2207d89e72ca9bd5021f3dc5a53ffac0ef337a2aea248a23a6');

do $assert$
begin
  if (select count(*) from information_schema.columns
    where table_schema='access' and table_name='membershiprole'
      and column_name in('assigned_scope_kind','assigned_scope_id','assigned_scope_path','scope_source'))<>4 then
    raise exception 'ACCESS_IDENTITY_SCOPE_ASSIGNMENTS_COLUMNS_INVALID';
  end if;
  if exists(select 1 from access.membershiprole assignment
    join access.role role on role.id=assignment.role_id
    where role.id not in('role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator')
      and (assignment.assigned_scope_kind is null or assignment.assigned_scope_id<>role.scope_id
        or assignment.assigned_scope_path is null or assignment.scope_source<>'inherited')) then
    raise exception 'ACCESS_IDENTITY_SCOPE_ASSIGNMENTS_BACKFILL_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260901100000'
      and checksum='78d8bc0b3efd7f2207d89e72ca9bd5021f3dc5a53ffac0ef337a2aea248a23a6') then
    raise exception 'ACCESS_IDENTITY_SCOPE_ASSIGNMENTS_LEDGER_MISSING';
  end if;
end
$assert$;

commit;
