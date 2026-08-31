begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830115000') then
    raise exception 'MEMBERSHIP_SELECTION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830120000') then
    raise exception 'MEMBERSHIP_SELECTION_ALREADY_APPLIED';
  end if;
end $precondition$;

alter table identity.preauth add column auth_state_hash char(64);
alter table identity.preauth add column auth_nonce_hash char(64);
alter table identity.preauth add column auth_pkce_challenge char(43);
alter table identity.preauth add column assurance smallint;

update identity.preauth preauth
set auth_state_hash=transaction.auth_state_hash,
    auth_nonce_hash=transaction.auth_nonce_hash,
    auth_pkce_challenge=transaction.auth_pkce_challenge,
    assurance=1
from identity.federationtransaction transaction
where preauth.transaction_id=transaction.id and preauth.purpose='federationselection';

alter table identity.preauth drop constraint preauth_federation_shape_valid;
alter table identity.preauth add constraint preauth_selection_shape_valid check(
  purpose<>'federationselection' or (
    principal_id is not null and candidate_hash is not null and jsonb_array_length(candidate_memberships)>=2
    and auth_state_hash~'^[0-9a-f]{64}$' and auth_nonce_hash~'^[0-9a-f]{64}$'
    and auth_pkce_challenge~'^[A-Za-z0-9_-]{43}$' and assurance between 1 and 3
  )
);

drop policy preauthapp on identity.preauth;
create policy preauthapp on identity.preauth for all to shopapp using(
  transaction_id is null or exists(select 1 from identity.federationtransaction transaction where transaction.id=transaction_id)
) with check(
  transaction_id is null or exists(select 1 from identity.federationtransaction transaction where transaction.id=transaction_id)
);

select runtime.record_migration_evidence('20260830120000',0,0,0,0,
  'create index concurrently if not exists identity_preauth_selection_live on identity.preauth(purpose,target,state,expires_at,id) where purpose=''federationselection'' and state=''active'';',
  'select purpose,target,state,count(*) from identity.preauth group by purpose,target,state order by purpose,target,state;');
insert into runtime.schemaversion(version,checksum)
values('20260830120000',encode(public.digest('20260830120000_unify_membership_selection','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from identity.preauth where purpose='federationselection' and
    (auth_state_hash is null or auth_nonce_hash is null or auth_pkce_challenge is null or assurance is null)) then
    raise exception 'MEMBERSHIP_SELECTION_BINDING_INVALID';
  end if;
end $assert$;

commit;

