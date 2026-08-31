begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830125000') then
    raise exception 'PREAUTH_SHAPE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830126000') then
    raise exception 'PREAUTH_SHAPE_ALREADY_APPLIED';
  end if;
end $precondition$;

update identity.preauth
set transaction_id=null,candidate_hash=null,candidate_memberships='[]'::jsonb,
  auth_state_hash=null,auth_nonce_hash=null,auth_pkce_challenge=null,assurance=null
where purpose in('invitationproof','enrollment');

alter table identity.preauth add constraint preauth_purpose_shape_valid check(
  (purpose='federationselection'
    and principal_id is not null and candidate_hash is not null
    and case when jsonb_typeof(candidate_memberships)='array' then jsonb_array_length(candidate_memberships) else -1 end>=2
    and auth_state_hash~'^[0-9a-f]{64}$' and auth_nonce_hash~'^[0-9a-f]{64}$'
    and auth_pkce_challenge~'^[A-Za-z0-9_-]{43}$' and assurance between 1 and 3)
  or (purpose='invitationproof' and target='console' and transaction_id is null and principal_id is not null
    and candidate_hash is null and candidate_memberships='[]'::jsonb and auth_state_hash is null
    and auth_nonce_hash is null and auth_pkce_challenge is null and assurance is null)
  or (purpose='enrollment' and target='storefront' and transaction_id is null and candidate_hash is null
    and candidate_memberships='[]'::jsonb and auth_state_hash is null and auth_nonce_hash is null
    and auth_pkce_challenge is null and assurance is null)
);

alter table identity.invitation add constraint invitation_active_capacity_valid
  check(status<>'active' or use_count<max_uses);
alter table identity.invitation add constraint invitation_exhausted_capacity_valid
  check(status<>'exhausted' or use_count=max_uses);

select runtime.record_migration_evidence('20260830126000',
  (select count(*) from identity.preauth where purpose in('invitationproof','enrollment')),
  (select count(*) from identity.preauth where purpose in('invitationproof','enrollment') and candidate_memberships='[]'::jsonb),
  0,0,
  'create index concurrently if not exists identity_preauth_invitation_resolution_live on identity.preauth(token_hash,purpose,target,state,expires_at) where purpose in(''invitationproof'',''enrollment'');',
  'select purpose,target,state,count(*) from identity.preauth group by purpose,target,state order by purpose,target,state;');
insert into runtime.schemaversion(version,checksum)
values('20260830126000',encode(public.digest('20260830126000_harden_preauth_invitation_shape','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from identity.preauth where
    (purpose='invitationproof' and (target<>'console' or principal_id is null or candidate_memberships<>'[]'::jsonb))
    or (purpose='enrollment' and (target<>'storefront' or candidate_memberships<>'[]'::jsonb))) then
    raise exception 'PREAUTH_INVITATION_SHAPE_INVALID';
  end if;
  if exists(select 1 from identity.invitation where
    (status='active' and use_count>=max_uses) or (status='exhausted' and use_count<>max_uses)) then
    raise exception 'INVITATION_CAPACITY_STATE_INVALID';
  end if;
end $assert$;

commit;
