begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260902021000') then
    raise exception 'STOREFRONT_SIGNIN_INVITATION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902022000') then
    raise exception 'STOREFRONT_SIGNIN_INVITATION_ALREADY_APPLIED';
  end if;
end
$precondition$;

alter table identity.preauth drop constraint preauth_purpose_shape_valid;
alter table identity.preauth add constraint preauth_purpose_shape_valid check(
  (purpose='federationselection'
    and principal_id is not null and candidate_hash is not null
    and case when jsonb_typeof(candidate_memberships)='array' then jsonb_array_length(candidate_memberships) else -1 end>=2
    and auth_state_hash~'^[0-9a-f]{64}$' and auth_nonce_hash~'^[0-9a-f]{64}$'
    and auth_pkce_challenge~'^[A-Za-z0-9_-]{43}$' and assurance between 1 and 3 and return_target is not null)
  or (purpose='invitationproof' and target in('console','storefront') and transaction_id is null and principal_id is not null
    and candidate_hash is null and candidate_memberships='[]'::jsonb
    and auth_state_hash~'^[0-9a-f]{64}$' and auth_nonce_hash~'^[0-9a-f]{64}$'
    and auth_pkce_challenge~'^[A-Za-z0-9_-]{43}$' and assurance is null and return_target is not null)
  or (purpose='enrollment' and target='storefront' and transaction_id is null
    and candidate_hash is null and candidate_memberships='[]'::jsonb
    and auth_state_hash~'^[0-9a-f]{64}$' and auth_nonce_hash~'^[0-9a-f]{64}$'
    and auth_pkce_challenge~'^[A-Za-z0-9_-]{43}$' and assurance is null and return_target is not null)
);

select runtime.record_migration_evidence(
  '20260902022000',
  (select count(*) from identity.preauth where purpose='invitationproof'),
  (select count(*) from identity.preauth where purpose='invitationproof' and target in('console','storefront')),
  0,0,
  'select purpose,target,state,count(*) from identity.preauth where purpose=''invitationproof'' group by purpose,target,state order by target,state;',
  'select purpose,target,state,count(*) from identity.preauth group by purpose,target,state order by purpose,target,state;'
);

insert into runtime.schemaversion(version,checksum)
values(
  '20260902022000',
  encode(public.digest('20260902022000_allow_storefront_signin_invitation','sha256'),'hex')
);

do $assert$
begin
  if exists(
    select 1 from identity.preauth
    where purpose='invitationproof' and (
      target not in('console','storefront') or transaction_id is not null or principal_id is null
      or candidate_hash is not null or candidate_memberships<>'[]'::jsonb
      or auth_state_hash!~'^[0-9a-f]{64}$' or auth_nonce_hash!~'^[0-9a-f]{64}$'
      or auth_pkce_challenge!~'^[A-Za-z0-9_-]{43}$' or assurance is not null or return_target is null
    )
  ) then raise exception 'SIGNIN_INVITATION_PREAUTH_SHAPE_INVALID'; end if;
end
$assert$;

commit;
