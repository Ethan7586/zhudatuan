begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830121000') then
    raise exception 'ACCESS_OWNERSHIP_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830122000') then
    raise exception 'ACCESS_OWNERSHIP_ALREADY_APPLIED';
  end if;
  if exists(
    select 1 from access.role role
    join access.membershiprole assignment on assignment.role_id=role.id
      and assignment.effective_at<=clock_timestamp()
      and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
    join access.membership membership on membership.id=assignment.membership_id and membership.status='active'
    where role.kind='owner' and role.status='active'
    group by role.id having count(*)<>1
  ) then raise exception 'ACCESS_ACTIVE_OWNER_NOT_UNIQUE'; end if;
end $precondition$;

create table access.ownership(
  scope_id text primary key,
  role_id text not null unique references access.role(id),
  membership_id text not null unique references access.membership(id),
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

insert into access.ownership(scope_id,role_id,membership_id)
select role.scope_id,role.id,membership.id
from access.role role
join access.membershiprole assignment on assignment.role_id=role.id
  and assignment.effective_at<=clock_timestamp()
  and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
join access.membership membership on membership.id=assignment.membership_id and membership.status='active'
where role.kind='owner' and role.status='active';

create function access.assert_owner_integrity() returns trigger
language plpgsql security definer set search_path=access,pg_temp set row_security=off as $function$
begin
  if exists(
    with active_owner as(
      select role.id role_id,role.scope_id,count(membership.id)::integer active_count,
        min(membership.id) filter(where membership.id is not null) membership_id
      from access.role role
      left join access.membershiprole assignment on assignment.role_id=role.id
        and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
      left join access.membership membership on membership.id=assignment.membership_id and membership.status='active'
      where role.kind='owner' and role.status='active' group by role.id,role.scope_id
    )
    select 1 from active_owner active
    left join access.ownership ownership on ownership.role_id=active.role_id
    left join access.membership membership on membership.id=ownership.membership_id
    where active.active_count>1
      or active.active_count=0 and ownership.role_id is not null
      or active.active_count=1 and (
        ownership.role_id is null or ownership.scope_id<>active.scope_id or ownership.membership_id<>active.membership_id
        or membership.organization_id<>active.scope_id or membership.status<>'active'
        or case membership.client when 'storefront' then 'storefront' else 'console' end<>'console'
      )
  ) or exists(
    select 1 from access.ownership ownership
    left join access.role role on role.id=ownership.role_id
    left join access.membership membership on membership.id=ownership.membership_id
    where role.id is null or role.kind<>'owner' or role.status<>'active' or role.scope_id<>ownership.scope_id
      or membership.id is null or membership.organization_id<>ownership.scope_id or membership.status<>'active'
      or case membership.client when 'storefront' then 'storefront' else 'console' end<>'console'
  ) then raise exception 'ACCESS_OWNER_INTEGRITY_VIOLATION'; end if;
  return null;
end
$function$;

create constraint trigger ownership_integrity after insert or update or delete on access.ownership
deferrable initially deferred for each row execute function access.assert_owner_integrity();
create constraint trigger membershiprole_owner_integrity after insert or update or delete on access.membershiprole
deferrable initially deferred for each row execute function access.assert_owner_integrity();
create constraint trigger membership_owner_integrity after update of status,organization_id,client on access.membership
deferrable initially deferred for each row execute function access.assert_owner_integrity();
create constraint trigger role_owner_integrity after insert or update of kind,status,scope_id or delete on access.role
deferrable initially deferred for each row execute function access.assert_owner_integrity();

create function access.sync_bootstrap_ownership() returns trigger
language plpgsql security definer set search_path=access,pg_temp set row_security=off as $function$
declare owner_scope text;
begin
  if session_user<>'zhudatuanbootstrap' then return new; end if;
  select role.scope_id into owner_scope from access.role role
  join access.membership membership on membership.id=new.membership_id
  where role.id=new.role_id and role.kind='owner' and role.status='active'
    and membership.organization_id=role.scope_id and membership.status='active'
    and case membership.client when 'storefront' then 'storefront' else 'console' end='console';
  if owner_scope is not null then
    insert into access.ownership(scope_id,role_id,membership_id)
    values(owner_scope,new.role_id,new.membership_id)
    on conflict(scope_id) do update set role_id=excluded.role_id,membership_id=excluded.membership_id,
      version=access.ownership.version+1,updated_at=clock_timestamp();
  end if;
  return new;
end
$function$;
create trigger membershiprole_bootstrap_ownership after insert on access.membershiprole
for each row execute function access.sync_bootstrap_ownership();

alter table access.ownership enable row level security;
create policy ownershipapp on access.ownership for all to shopapp
using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy ownershipjob on access.ownership for all to shopjob using(true) with check(true);
grant select,insert,update,delete on access.ownership to shopapp,shopjob;

insert into runtime.operation(id,owner,method,path,contract_version)
values('access.owners.transfer','access','PUT','/api/v1/access/owners/transfer','3.0.0');
insert into runtime.event(type,version,owner,schema_ref)
values('access.owner.transferred',1,'access','contract://events/access.owner.transferred/v1');
insert into access.permission(id,code,risk,status)
values('permission:c94473937884e076e5dd299c','access.owner.transfer','critical','active')
on conflict(code) do update set risk=excluded.risk,status='active';
insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow' from access.role role cross join access.permission permission
where role.kind='owner' and role.status='active' and permission.code='access.owner.transfer'
on conflict do nothing;
insert into capability.capability(id,kind,name,version,status)
values('access.owners.transfer','operation','access.owners.transfer',3,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('access.owners.transfer','access.owners.transfer','access.owner.transfer','console');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:access.owners.transfer','organization-platform-root','access.owners.transfer','enabled',null,
  '1970-01-01T00:00:00Z',null,0);

update runtime.contractcatalog
set checksum='e5bb3e0b7ba11583dec7abd731806deeeed566b1c01377d6acb668f510631ce1',
  operation_count=238,event_count=79,published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830122000',1,
  (select count(*) from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active'
    and checksum='e5bb3e0b7ba11583dec7abd731806deeeed566b1c01377d6acb668f510631ce1'
    and operation_count=238 and event_count=79),0,0,
  'create unique index concurrently if not exists access_ownership_membership_live on access.ownership(membership_id);',
  'select scope_id,role_id,membership_id,version from access.ownership order by scope_id;');
insert into runtime.schemaversion(version,checksum)
values('20260830122000','e5bb3e0b7ba11583dec7abd731806deeeed566b1c01377d6acb668f510631ce1');

do $assert$ begin
  if exists(select 1 from access.ownership ownership join access.role role on role.id=ownership.role_id
    where role.kind<>'owner' or role.scope_id<>ownership.scope_id) then
    raise exception 'ACCESS_OWNERSHIP_KIND_INVALID';
  end if;
  if not exists(select 1 from runtime.operation where id='access.owners.transfer' and owner='access')
    or not exists(select 1 from runtime.event where type='access.owner.transferred' and owner='access')
    or not exists(select 1 from access.permission where code='access.owner.transfer' and status='active') then
    raise exception 'ACCESS_OWNER_CONTRACT_INVALID';
  end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active'
    and checksum='e5bb3e0b7ba11583dec7abd731806deeeed566b1c01377d6acb668f510631ce1'
    and operation_count=238 and event_count=79) then
    raise exception 'ACCESS_OWNER_CONTRACT_IDENTITY_INVALID';
  end if;
end $assert$;

commit;
