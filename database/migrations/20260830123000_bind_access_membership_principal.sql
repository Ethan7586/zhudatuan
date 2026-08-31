begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830122000') then
    raise exception 'ACCESS_MEMBERSHIP_PRINCIPAL_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830123000') then
    raise exception 'ACCESS_MEMBERSHIP_PRINCIPAL_ALREADY_APPLIED';
  end if;
end $precondition$;

alter table access.membership add column principal_id text;
update access.membership membership set principal_id=profile.principal_id
from member.profile profile where profile.id=membership.member_id;

do $backfill$ begin
  if exists(select 1 from access.membership where principal_id is null) then
    raise exception 'ACCESS_MEMBERSHIP_PRINCIPAL_BACKFILL_INCOMPLETE';
  end if;
end $backfill$;

alter table access.membership alter column principal_id set not null;
create index access_membership_principal_target on access.membership(principal_id,client,status,id);
create unique index access_membership_principal_organization_client
on access.membership(principal_id,organization_id,client);

select runtime.record_migration_evidence('20260830123000',
  (select count(*) from access.membership),
  (select count(*) from access.membership where principal_id is not null),0,0,
  'create index concurrently if not exists access_membership_principal_target_live on access.membership(principal_id,client,status,id);',
  'select client,status,count(*) from access.membership group by client,status order by client,status;');
insert into runtime.schemaversion(version,checksum)
values('20260830123000',encode(public.digest('20260830123000_bind_access_membership_principal','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from access.membership membership left join member.profile profile on profile.id=membership.member_id
    where membership.principal_id is distinct from profile.principal_id) then
    raise exception 'ACCESS_MEMBERSHIP_PRINCIPAL_BINDING_INVALID';
  end if;
end $assert$;

commit;
