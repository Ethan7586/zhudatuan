begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830108000') then
    raise exception 'CAMPAIGN_ENROLLMENT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830109000') then
    raise exception 'CAMPAIGN_ENROLLMENT_ALREADY_APPLIED';
  end if;
  if exists(select mobile_token from member.profile where mobile_token is not null and status in('pending','active')
    group by mobile_token having count(*)>1) then
    raise exception 'MEMBER_MOBILE_IDENTITY_CONFLICT';
  end if;
end $precondition$;

alter table identity.invitationclaim add column kind text;
update identity.invitationclaim claim set kind=invitation.kind
from identity.invitation invitation where invitation.id=claim.invitation_id;
alter table identity.invitationclaim alter column kind set not null;
alter table identity.invitationclaim add constraint invitationclaim_kind_valid check(kind in('signin','enrollment','campaign'));

drop index identity.identity_invitationclaim_open;
create unique index identity_invitationclaim_personal_open on identity.invitationclaim(invitation_id)
  where kind in('signin','enrollment') and state in('reserved','proofpending','proved');
create index identity_invitationclaim_campaign_capacity on identity.invitationclaim(invitation_id,state,expires_at,id)
  where kind='campaign' and state in('reserved','proofpending','proved');
create unique index member_profile_mobile_identity on member.profile(mobile_token)
  where mobile_token is not null and status in('pending','active');

select runtime.record_migration_evidence('20260830109000',
  (select count(*) from identity.invitationclaim),
  (select count(*) from identity.invitationclaim where kind in('signin','enrollment','campaign')),0,0,
  'create index concurrently if not exists identity_invitationclaim_campaign_capacity_live on identity.invitationclaim(invitation_id,state,expires_at,id) where kind=''campaign'' and state in(''reserved'',''proofpending'',''proved'');',
  'select invitation_id,count(*) from identity.invitationclaim where kind=''campaign'' and state in(''reserved'',''proofpending'',''proved'') and expires_at>clock_timestamp() group by invitation_id order by invitation_id;');
insert into runtime.schemaversion(version,checksum)
values('20260830109000',encode(public.digest('20260830109000_complete_campaign_enrollment','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from identity.invitationclaim where kind is null) then
    raise exception 'INVITATION_CLAIM_KIND_MISSING';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='identity' and indexname='identity_invitationclaim_personal_open')
    or not exists(select 1 from pg_indexes where schemaname='member' and indexname='member_profile_mobile_identity') then
    raise exception 'CAMPAIGN_ENROLLMENT_INDEX_MISSING';
  end if;
end $assert$;

commit;
