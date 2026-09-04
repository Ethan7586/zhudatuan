begin;

update access.scopegrant scopeassignment
set scope_id='self:'||profile.principal_id,scope_path='self:'||profile.principal_id
from access.membership membership
join member.profile profile on profile.id=membership.member_id
where membership.id=scopeassignment.membership_id and scopeassignment.scope_kind='self'
  and (access.scope_object(scopeassignment.scope_id) is null
    or access.scope_object(scopeassignment.scope_id)->>'kind'<>'self');

update access.scopegrant scopeassignment
set scope_id=membership.member_id,scope_path=membership.member_id
from access.membership membership
where membership.id=scopeassignment.membership_id and scopeassignment.scope_kind='owner'
  and (access.scope_object(scopeassignment.scope_id) is null
    or access.scope_object(scopeassignment.scope_id)->>'kind'<>'owner');

update access.scopegrant scopeassignment
set scope_id=ancestor.id,scope_path=ancestor.id
from access.membership membership
join organization.unitclosure closure on closure.descendant_id=membership.organization_id
join organization.organization ancestor on ancestor.id=closure.ancestor_id
where membership.id=scopeassignment.membership_id
  and scopeassignment.scope_kind in('platform','distributor','tenant','enterprise','mall','department')
  and ancestor.kind=scopeassignment.scope_kind
  and (access.scope_object(scopeassignment.scope_id) is null
    or access.scope_object(scopeassignment.scope_id)->>'kind'<>scopeassignment.scope_kind);

insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
select 'scope:'||membership.id||':self',membership.id,'self','self:'||profile.principal_id,'self:'||profile.principal_id,
  'allow','1970-01-01T00:00:00Z',membership.access_version
from access.membership membership join member.profile profile on profile.id=membership.member_id
where membership.status='active'
on conflict(id) do update set scope_kind=excluded.scope_kind,scope_id=excluded.scope_id,scope_path=excluded.scope_path,
  effect=excluded.effect,effective_at=excluded.effective_at,access_version=excluded.access_version,expires_at=null;

insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
select 'scope:'||membership.id||':owner',membership.id,'owner',membership.member_id,membership.member_id,
  'allow','1970-01-01T00:00:00Z',membership.access_version
from access.membership membership
where membership.status='active' and membership.client='storefront'
on conflict(id) do update set scope_kind=excluded.scope_kind,scope_id=excluded.scope_id,scope_path=excluded.scope_path,
  effect=excluded.effect,effective_at=excluded.effective_at,access_version=excluded.access_version,expires_at=null;

delete from access.scopegrant duplicate
using access.scopegrant canonical
where duplicate.membership_id=canonical.membership_id and duplicate.scope_kind=canonical.scope_kind
  and duplicate.scope_id=canonical.scope_id and duplicate.effect=canonical.effect
  and (duplicate.effective_at>canonical.effective_at
    or duplicate.effective_at=canonical.effective_at and duplicate.id>canonical.id);

insert into runtime.schemaversion(version,checksum)
values('20260821061000','7813229606ada9827c8b8c03308a5bbd322e3624dde12280816b2818ae12ca03');

do $assert$ begin
  if exists(
    select 1 from access.scopegrant scopeassignment
    where access.scope_object(scopeassignment.scope_id) is null
      or access.scope_object(scopeassignment.scope_id)->>'kind'<>scopeassignment.scope_kind
  ) then raise exception 'MEMBERSHIP_SCOPE_KIND_MISMATCH'; end if;
  if exists(
    select 1 from access.scopegrant
    group by membership_id,scope_kind,scope_id,effect having count(*)>1
  ) then raise exception 'MEMBERSHIP_SCOPE_DUPLICATE'; end if;
end $assert$;

commit;
