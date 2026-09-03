begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260902024000') then
    raise exception 'IDENTITY_MEMBERSHIP_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260903100000') then
    raise exception 'IDENTITY_MEMBERSHIP_ALREADY_APPLIED';
  end if;
end
$precondition$;

insert into runtime.operation(id,owner,method,path,contract_version)
values('identity.bootstrap.read','identity','GET','/api/v1/identity/bootstrap','4.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;

insert into capability.capability(id,kind,name,version,status)
values('identity.bootstrap.read','operation','identity.bootstrap.read',3,'active')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,version=excluded.version,status=excluded.status;

insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('identity.bootstrap.read','identity.bootstrap.read',null,'public')
on conflict(operation_id) do update set capability_id=excluded.capability_id,permission_code=excluded.permission_code,audience=excluded.audience;

create function access.identity_memberships(p_member text,p_target text,p_memberships text[])
returns table(
  id text,principal_id text,client text,organization_id text,access_version bigint,
  display_name text,organization_name text,scope_kind text,role_label text
)
language sql stable security definer
set search_path=access,member,organization,pg_temp
set row_security=off
as $function$
  select membership.id,membership.principal_id,membership.client,membership.organization_id,
    membership.access_version,profile.display_name,organization.name,organization.kind,role.name
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id and profile.status='active'
  join organization.organization organization on organization.id=membership.organization_id and organization.status='active'
  left join lateral(
    select candidate.name from access.membershiprole assignment
    join access.role candidate on candidate.id=assignment.role_id and candidate.status='active'
    where assignment.membership_id=membership.id and assignment.effective_at<=clock_timestamp()
      and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
    order by case candidate.kind when 'owner' then 0 when 'system' then 1 else 2 end,candidate.name,candidate.id
    limit 1
  ) role on true
  where membership.status='active'
    and (p_member is not null or p_memberships is not null)
    and (p_member is null or membership.member_id=p_member)
    and (p_target is null or (case when membership.client='storefront' then 'storefront' else 'console' end)=p_target)
    and (p_memberships is null or membership.id=any(p_memberships))
$function$;

create function access.membership_visible_to(p_scope text,p_membership text)
returns boolean language sql stable security definer
set search_path=access,organization,pg_temp
set row_security=off
as $function$
  select exists(
    select 1 from access.membership membership
    where membership.id=p_membership and (
      exists(select 1 from organization.unitclosure governed
        where governed.ancestor_id=p_scope and governed.descendant_id=membership.organization_id)
      or exists(select 1 from access.scopegrant allowed
        join organization.unitclosure granted on granted.ancestor_id=allowed.scope_id and granted.descendant_id=p_scope
        where allowed.membership_id=membership.id and allowed.effect='allow'
          and allowed.effective_at<=clock_timestamp() and (allowed.expires_at is null or allowed.expires_at>clock_timestamp())
          and not exists(select 1 from access.scopegrant denied
            join organization.unitclosure blocked on blocked.ancestor_id=denied.scope_id and blocked.descendant_id=p_scope
            where denied.membership_id=membership.id and denied.effect='deny'
              and denied.effective_at<=clock_timestamp() and (denied.expires_at is null or denied.expires_at>clock_timestamp())))
    )
  )
$function$;

create function member.profile_summary(p_member text,p_scope text)
returns table(id text,display_name text,employee_no text,mobile_masked text,status text,version bigint)
language sql stable security definer
set search_path=member,access,organization,pg_temp
set row_security=off
as $function$
  select profile.id,profile.display_name,membership.employee_no,profile.mobile_masked,profile.status,profile.version
  from member.profile profile
  left join lateral (
    select candidate.employee_no from access.membership candidate
    where candidate.member_id=profile.id and candidate.status='active'
      and exists(select 1 from organization.unitclosure related
        where (related.ancestor_id=p_scope and related.descendant_id=candidate.organization_id)
          or (related.ancestor_id=candidate.organization_id and related.descendant_id=p_scope))
    order by (candidate.organization_id=p_scope) desc,candidate.id limit 1
  ) membership on true
  where profile.id=p_member and profile.status='active'
$function$;

revoke all on function access.identity_memberships(text,text,text[]),access.membership_visible_to(text,text),member.profile_summary(text,text) from public;
grant execute on function access.identity_memberships(text,text,text[]),access.membership_visible_to(text,text),member.profile_summary(text,text) to shopapp;

alter table runtime.mvpauthority disable row level security;
update runtime.mvpauthority
set checksum=encode(public.digest('packages/contract/definitions/operations.yml:275','sha256'),'hex'),
  expected_count=275,observed_count=275,published_at=clock_timestamp()
where id='mvp:operations';
alter table runtime.mvpauthority enable row level security;

update runtime.contractcatalog
set checksum='bf156c5335a436a72f803cda376fc8f26bc3a037bc7e17b0204187d7065fef29',
  operation_count=275,published_at=clock_timestamp()
where artifact='commerce' and version='4.0.0' and status='active';

create index access_membership_member_target_live
on access.membership(member_id,client,id)
include(organization_id,access_version,principal_id)
where status='active';

select runtime.record_migration_evidence(
  '20260903100000',0,0,0,0,
  'create index concurrently if not exists access_membership_member_target_live on access.membership(member_id,client,id) include(organization_id,access_version,principal_id) where status=''active'';',
  'select client,count(*) from access.membership where status=''active'' group by client order by client;'
);

insert into runtime.schemaversion(version,checksum)
values(
  '20260903100000',
  encode(public.digest('20260903100000_enrich_identity_membership','sha256'),'hex')
);

do $assert$
begin
  if not exists(
    select 1 from pg_indexes
    where schemaname='access' and indexname='access_membership_member_target_live'
      and indexdef like '%(member_id, client, id)%'
      and indexdef like '%WHERE (status = ''active''::text)%'
  ) then
    raise exception 'IDENTITY_MEMBERSHIP_INDEX_INVALID';
  end if;
  if to_regprocedure('access.identity_memberships(text,text,text[])') is null
    or to_regprocedure('access.membership_visible_to(text,text)') is null
    or to_regprocedure('member.profile_summary(text,text)') is null then
    raise exception 'IDENTITY_MEMBERSHIP_READ_CONTRACT_MISSING';
  end if;
  if has_function_privilege('anon','access.identity_memberships(text,text,text[])','EXECUTE')
    or has_function_privilege('anon','access.membership_visible_to(text,text)','EXECUTE')
    or has_function_privilege('anon','member.profile_summary(text,text)','EXECUTE') then
    raise exception 'IDENTITY_MEMBERSHIP_READ_CONTRACT_PUBLIC';
  end if;
  if not exists(
    select 1 from runtime.operation operation
    join capability.operation binding on binding.operation_id=operation.id
    join capability.capability capability on capability.id=binding.capability_id
    where operation.id='identity.bootstrap.read' and operation.method='GET'
      and operation.path='/api/v1/identity/bootstrap' and operation.contract_version='4.0.0'
      and binding.permission_code is null and binding.audience='public'
      and capability.kind='operation' and capability.status='active'
  ) then
    raise exception 'IDENTITY_BOOTSTRAP_OPERATION_INVALID';
  end if;
  if not exists(
    select 1 from runtime.contractcatalog where artifact='commerce' and version='4.0.0' and status='active'
      and checksum='bf156c5335a436a72f803cda376fc8f26bc3a037bc7e17b0204187d7065fef29'
      and operation_count=275 and event_count=103
  ) then
    raise exception 'IDENTITY_BOOTSTRAP_CONTRACT_INVALID';
  end if;
end
$assert$;

commit;
