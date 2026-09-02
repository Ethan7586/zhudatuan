begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260902016000') then
    raise exception 'EMPLOYEE_INVITATION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902017000') then
    raise exception 'EMPLOYEE_INVITATION_ALREADY_APPLIED';
  end if;
end
$precondition$;

create or replace function identity.protect_invitation_receipt_shape() returns trigger
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $function$
declare invitation_kind text;
begin
  select invitation.kind into invitation_kind from identity.invitation invitation where invitation.id=new.invitation_id;
  if invitation_kind is null
    or (invitation_kind='campaign' and new.session_id is not null)
    or (invitation_kind<>'campaign' and new.session_id is null) then
    raise exception 'INVITATION_RECEIPT_SHAPE_INVALID';
  end if;
  return new;
end $function$;
revoke all on function identity.protect_invitation_receipt_shape() from public;

create unique index access_membership_employee_unique
on access.membership(organization_id,client,employee_no)
where employee_no is not null and status in('invited','active');

create index identity_invitation_scope_created
on identity.invitation(organization_id,created_at desc,id desc);

alter table identity.preauth drop constraint preauth_purpose_shape_valid;
alter table identity.preauth drop constraint preauth_return_target_shape_valid;
alter table identity.preauth add constraint preauth_purpose_shape_valid check(
  (purpose='federationselection'
    and principal_id is not null and candidate_hash is not null
    and case when jsonb_typeof(candidate_memberships)='array' then jsonb_array_length(candidate_memberships) else -1 end>=2
    and auth_state_hash~'^[0-9a-f]{64}$' and auth_nonce_hash~'^[0-9a-f]{64}$'
    and auth_pkce_challenge~'^[A-Za-z0-9_-]{43}$' and assurance between 1 and 3 and return_target is not null)
  or (purpose='invitationproof' and target='console' and transaction_id is null and principal_id is not null
    and candidate_hash is null and candidate_memberships='[]'::jsonb
    and auth_state_hash~'^[0-9a-f]{64}$' and auth_nonce_hash~'^[0-9a-f]{64}$'
    and auth_pkce_challenge~'^[A-Za-z0-9_-]{43}$' and assurance is null and return_target is not null)
  or (purpose='enrollment' and target='storefront' and transaction_id is null
    and candidate_hash is null and candidate_memberships='[]'::jsonb
    and auth_state_hash~'^[0-9a-f]{64}$' and auth_nonce_hash~'^[0-9a-f]{64}$'
    and auth_pkce_challenge~'^[A-Za-z0-9_-]{43}$' and assurance is null and return_target is not null)
);
alter table identity.preauth add constraint preauth_return_target_shape_valid
check(return_target is null or length(return_target) between 1 and 4096);

drop function identity.resolve_preauth(bytea,bytea,bytea,text,text);
create function identity.resolve_preauth(
  p_token_hash bytea,p_browser_hash bytea,p_device_hash bytea,p_purpose text,p_target text
)
returns table(
  id text,purpose text,target text,principal_id text,reference_id text,version bigint,expires_at timestamptz,
  auth_state_hash text,auth_nonce_hash text,auth_pkce_challenge text,return_target text
)
language sql stable security definer set search_path=identity,pg_temp as $function$
  select preauth.id::text,preauth.purpose,preauth.target,preauth.principal_id,preauth.reference_id,
    preauth.version,preauth.expires_at,preauth.auth_state_hash::text,preauth.auth_nonce_hash::text,
    preauth.auth_pkce_challenge::text,preauth.return_target
  from identity.preauth preauth
  where preauth.token_hash=p_token_hash and preauth.browser_hash=p_browser_hash
    and preauth.device_hash=p_device_hash and preauth.purpose=p_purpose and preauth.target=p_target
    and preauth.state='active' and preauth.consumed_at is null and preauth.expires_at>clock_timestamp()
$function$;
revoke all on function identity.resolve_preauth(bytea,bytea,bytea,text,text) from public;
grant execute on function identity.resolve_preauth(bytea,bytea,bytea,text,text) to shopapp;

drop policy invitationapi on identity.invitation;
create policy invitationapi on identity.invitation for all to shopapp using(
  current_setting('app.workload',true)='api' and (
    current_setting('app.operation_id',true) in(
      'identity.sessions.complete','identity.invitations.resolve','identity.enrollments.read',
      'identity.enrollments.complete','identity.challenges.create')
    or access.scope_allowed(organization_id)
  )
) with check(
  current_setting('app.workload',true)='api' and (
    current_setting('app.operation_id',true) in('identity.sessions.complete','identity.enrollments.complete')
    or access.scope_allowed(organization_id)
  )
);

drop policy invitationclaimapi on identity.invitationclaim;
create policy invitationclaimapi on identity.invitationclaim for all to shopapp using(
  current_setting('app.workload',true)='api' and current_setting('app.operation_id',true) in(
    'identity.sessions.complete','identity.invitations.resolve','identity.enrollments.read',
    'identity.enrollments.complete','identity.challenges.create')
) with check(
  current_setting('app.workload',true)='api' and current_setting('app.operation_id',true) in(
    'identity.sessions.complete','identity.invitations.resolve','identity.enrollments.complete','identity.challenges.create')
);

drop policy invitationjob on identity.invitation;
drop policy invitationclaimjob on identity.invitationclaim;
drop policy invitationreceiptjobread on identity.invitationreceipt;
create policy invitationcleanupjob on identity.invitation for select to shopjob using(
  current_setting('app.workload',true)='jobs' and current_setting('app.operation_id',true)='job.identity.invitationcleanup'
);
create policy invitationcleanupjobupdate on identity.invitation for update to shopjob using(
  current_setting('app.workload',true)='jobs' and current_setting('app.operation_id',true)='job.identity.invitationcleanup'
) with check(
  current_setting('app.workload',true)='jobs' and current_setting('app.operation_id',true)='job.identity.invitationcleanup'
);
create policy invitationclaimcleanupjob on identity.invitationclaim for select to shopjob using(
  current_setting('app.workload',true)='jobs' and current_setting('app.operation_id',true)='job.identity.invitationcleanup'
);
create policy invitationclaimcleanupjobupdate on identity.invitationclaim for update to shopjob using(
  current_setting('app.workload',true)='jobs' and current_setting('app.operation_id',true)='job.identity.invitationcleanup'
) with check(
  current_setting('app.workload',true)='jobs' and current_setting('app.operation_id',true)='job.identity.invitationcleanup'
);

drop policy invitationreceiptapiwrite on identity.invitationreceipt;
drop policy invitationreceiptapiwriteview on identity.invitationreceipt;
create policy invitationreceiptapiwrite on identity.invitationreceipt for insert to shopapp with check(
  current_setting('app.workload',true)='api' and current_setting('app.operation_id',true) in(
    'identity.sessions.complete','identity.enrollments.complete')
);
create policy invitationreceiptapiwriteview on identity.invitationreceipt for select to shopapp using(
  current_setting('app.workload',true)='api' and current_setting('app.operation_id',true) in(
    'identity.sessions.complete','identity.enrollments.complete')
);

revoke delete on identity.invitation,identity.invitationclaim from shopjob;

select runtime.record_migration_evidence(
  '20260902017000',0,0,0,0,
  'create index concurrently if not exists access_membership_employee_unique_live on access.membership(organization_id,client,employee_no) where employee_no is not null and status in(''invited'',''active'');',
  'select kind,target,status,count(*) from identity.invitation group by kind,target,status order by kind,target,status;'
);
insert into runtime.schemaversion(version,checksum)
values('20260902017000',encode(public.digest('20260902017000_prepare_employee_invitation','sha256'),'hex'));

do $assert$
begin
  if exists(
    select 1 from identity.principal principal
    where principal.status='pending' and not exists(
      select 1 from member.profile profile where profile.principal_id=principal.id and profile.status='pending'
    )
  ) then raise exception 'ORPHAN_PENDING_PRINCIPAL'; end if;
  if exists(
    select 1 from identity.invitation invitation
    left join access.membership membership on membership.id=invitation.membership_id
    left join identity.principal principal on principal.id=membership.principal_id
    left join member.profile profile on profile.id=membership.member_id and profile.principal_id=membership.principal_id
    where invitation.kind='enrollment' and invitation.status in('draft','active') and (
      invitation.target<>'storefront' or invitation.max_uses<>1 or invitation.membership_id is null
      or invitation.principal_id is not null or invitation.recipient_hash is null or invitation.policy_id is null
      or invitation.terms_hash is null or membership.status<>'invited' or membership.client<>'storefront'
      or principal.status<>'pending' or profile.status<>'pending'
    )
  ) then raise exception 'EMPLOYEE_INVITATION_SHAPE_INVALID'; end if;
  if exists(
    select 1 from access.membership where employee_no is not null and status in('invited','active')
    group by organization_id,client,employee_no having count(*)>1
  ) then raise exception 'ACTIVE_EMPLOYEE_NUMBER_DUPLICATE'; end if;
  if exists(
    select 1 from member.profile where mobile_token is not null and status in('pending','active')
    group by mobile_token having count(*)>1
  ) then raise exception 'ACTIVE_MOBILE_TOKEN_DUPLICATE'; end if;
  if exists(
    select 1 from information_schema.columns where table_schema='identity' and table_name='invitation'
    and column_name in('code','token','token_plaintext','invitation_code')
  ) then raise exception 'INVITATION_PLAINTEXT_COLUMN_PRESENT'; end if;
end
$assert$;

commit;
