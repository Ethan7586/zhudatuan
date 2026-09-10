begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830126000') then
    raise exception 'INVITATION_AUDIT_SHAPE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830127000') then
    raise exception 'INVITATION_AUDIT_SHAPE_ALREADY_APPLIED';
  end if;
end $precondition$;

create policy invitationmigration on identity.invitation for all to shopmigration
  using(true) with check(true);

alter table identity.invitation add column created_by text;
alter table identity.invitation add column updated_at timestamptz;
update identity.invitation
set created_by=issuer_membership_id,updated_at=created_at;
alter table identity.invitation alter column created_by set not null;
alter table identity.invitation alter column updated_at set not null;

create index identity_invitation_organization_created
on identity.invitation(organization_id,created_at desc,id desc);
create index identity_invitation_principal_status
on identity.invitation(principal_id,status) where principal_id is not null;

create function identity.enforce_invitation_membership_target() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $function$
declare membership_target text;
begin
  if new.membership_id is null then return new; end if;
  select case membership.client when 'operator' then 'console' else membership.client end
  into membership_target
  from access.membership membership where membership.id=new.membership_id;
  if membership_target is null or membership_target<>new.target then
    raise exception 'INVITATION_MEMBERSHIP_TARGET_INVALID';
  end if;
  return new;
end
$function$;
revoke all on function identity.enforce_invitation_membership_target() from public;
create trigger identity_invitation_membership_target
before insert or update of membership_id,target on identity.invitation
for each row execute function identity.enforce_invitation_membership_target();

select runtime.record_migration_evidence('20260830127000',
  (select count(*) from identity.invitation),
  (select count(*) from identity.invitation where created_by is not null and updated_at is not null),0,0,
  'create index concurrently if not exists identity_invitation_organization_created_live on identity.invitation(organization_id,created_at desc,id desc);',
  'select organization_id,status,count(*) from identity.invitation group by organization_id,status order by organization_id,status;');
insert into runtime.schemaversion(version,checksum)
values('20260830127000',encode(public.digest('20260830127000_complete_invitation_audit_shape','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from identity.invitation where created_by is null or updated_at is null) then
    raise exception 'INVITATION_AUDIT_SHAPE_INVALID';
  end if;
  if exists(select 1 from identity.invitation invitation
    join access.membership membership on membership.id=invitation.membership_id
    where invitation.target<>case membership.client when 'operator' then 'console' else membership.client end) then
    raise exception 'INVITATION_MEMBERSHIP_TARGET_DIVERGED';
  end if;
  if not exists(select 1 from pg_trigger where tgname='identity_invitation_membership_target' and not tgisinternal) then
    raise exception 'INVITATION_MEMBERSHIP_TARGET_TRIGGER_MISSING';
  end if;
end $assert$;

drop policy invitationmigration on identity.invitation;

commit;
