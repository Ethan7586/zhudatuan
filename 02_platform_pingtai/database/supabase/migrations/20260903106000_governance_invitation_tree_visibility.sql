begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:governance-invitation-tree-visibility:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260903105000'
        and checksum='382abadcefe08c037c15d34d56af7f85236368b199f382cfa71ac63f2bef77cf')
    or exists(select 1 from runtime.schemaversion where version>'20260903105000') then
    raise exception 'GOVERNANCE_INVITATION_TREE_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

alter table access.membership
  add column governance_parent_membership_id text
    references access.membership(id) on delete set null deferrable initially deferred;

create index access_membership_governance_parent_idx
  on access.membership(governance_parent_membership_id)
  where governance_parent_membership_id is not null;

with parent as(
  select distinct on(invitation.accepted_membership_id)
    invitation.accepted_membership_id child_membership_id,
    invitation.created_by parent_membership_id
  from member.invite invitation
  join access.membership child on child.id=invitation.accepted_membership_id and child.client='operator'
  where invitation.target_client='operator'
    and invitation.accepted_membership_id is not null
    and (invitation.accepted_at is not null or invitation.use_count>0)
  order by invitation.accepted_membership_id,
    coalesce(invitation.accepted_at,invitation.created_at),invitation.created_at,invitation.id
)
update access.membership membership
set governance_parent_membership_id=parent.parent_membership_id
from parent
where membership.id=parent.child_membership_id
  and membership.governance_parent_membership_id is null;

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
      or accepted_membership_id=nullif(current_setting('app.membership_id',true),'')
      or access.zhudatuan_owner_context()
    )
  )
);

insert into runtime.schemaversion(version,checksum)
values('20260903106000','44bbc40daf78e233a94bcda38e9323e3fb874d892393291943c9f38b00228d87');

commit;
