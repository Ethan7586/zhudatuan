begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:invitation-record-target-and-creator-scope:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260903101000'
        and checksum='9fda96e5366b237ab082e0217e5bfb48f8cda0632293df68a1e282c8a886cbc7')
    or exists(select 1 from runtime.schemaversion where version>'20260903101000') then
    raise exception 'INVITATION_RECORD_TARGET_AND_CREATOR_SCOPE_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

alter table member.invite
  add column destination_masked text,
  add column accepted_membership_id text
    references access.membership(id) on delete set null deferrable initially deferred;

update member.invite invitation
set destination_masked=profile.mobile_masked
from member.profile profile
where invitation.target_client='operator'
  and invitation.destination_masked is null
  and invitation.allowed_destination_hash=profile.mobile_token
  and profile.mobile_masked is not null;

with accepted as(
  select distinct on(invitation.id) invitation.id invitation_id,membership.id membership_id
  from member.invite invitation
  join member.profile profile on profile.mobile_token=invitation.allowed_destination_hash
  join access.membership membership on membership.member_id=profile.id
    and membership.organization_id=invitation.organization_id and membership.client='operator'
  where invitation.target_client='operator'
    and (invitation.accepted_at is not null or invitation.use_count>0)
  order by invitation.id,(membership.status='active') desc,membership.joined_at desc nulls last,membership.id
)
update member.invite invitation
set accepted_membership_id=accepted.membership_id
from accepted where accepted.invitation_id=invitation.id;

drop policy if exists zhudatuanidentityapi on member.invite;
create policy zhudatuanidentityapi on member.invite for select to zhudatuanidentityapi using(
  (
    nullif(current_setting('app.membership_id',true),'') is null
    and status='active' and effective_at<=clock_timestamp() and expires_at>clock_timestamp()
    and (use_count<max_uses or (use_count=max_uses and accepted_at>=transaction_timestamp()))
    and (
      (target_client='storefront' and role_id='role-zhudatuan-storefront-member'
        and organization_id='mall-zhudatuan' and storefront_organization_id is null)
      or (target_client='operator'
        and (role_id='role-zhudatuan-pending-operator'
          or role_id='role-senior-administrator-v1:'||organization_id)
        and organization_id='tenant-zhudatuan' and storefront_organization_id='mall-zhudatuan'
        and allowed_destination_hash is not null and max_uses=1)
    )
  ) or (
    access.zhudatuan_operator_invitation_allowed(role_id,false)
    and target_client='operator' and organization_id='tenant-zhudatuan'
    and (
      created_by=nullif(current_setting('app.membership_id',true),'')
      or access.zhudatuan_owner_context()
    )
  )
);

insert into runtime.schemaversion(version,checksum)
values('20260903102000','6ccf447fd41ac42af725555b3e24ede4fa0a7cdeb9e64eb2f32ab8686d368ece');

commit;
