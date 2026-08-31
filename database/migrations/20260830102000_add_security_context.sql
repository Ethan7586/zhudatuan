begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830101000') then
    raise exception 'SECURITY_CONTEXT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830102000') then
    raise exception 'SECURITY_CONTEXT_ALREADY_APPLIED';
  end if;
end $precondition$;

alter table identity.preauth add column purpose text not null default 'federationselection';
alter table identity.preauth add column target text;
alter table identity.preauth add column reference_id text;
alter table identity.preauth add column device_hash bytea;
alter table identity.preauth add column state text not null default 'active';
alter table identity.preauth add column version bigint not null default 0;

update identity.preauth preauth
set target=transaction.target,reference_id=transaction.id::text,device_hash=preauth.browser_hash,
  state=case when preauth.consumed_at is null then 'active' else 'consumed' end
from identity.federationtransaction transaction
where transaction.id=preauth.transaction_id;

alter table identity.preauth alter column target set not null;
alter table identity.preauth alter column reference_id set not null;
alter table identity.preauth alter column device_hash set not null;
alter table identity.preauth add constraint preauth_purpose_valid
  check(purpose in('federationselection','invitationproof','enrollment'));
alter table identity.preauth add constraint preauth_target_valid check(target in('console','storefront'));
alter table identity.preauth add constraint preauth_state_valid check(state in('active','consumed','revoked','expired'));
alter table identity.preauth add constraint preauth_version_valid check(version>=0);
alter table identity.preauth add constraint preauth_consumption_state_valid check(
  (state='consumed' and consumed_at is not null) or (state<>'consumed' and consumed_at is null));
alter table identity.preauth add constraint preauth_federation_shape_valid check(
  purpose<>'federationselection' or transaction_id is not null);

create index identity_preauth_resolution
on identity.preauth(token_hash,purpose,target,state,expires_at);

create function identity.resolve_preauth(
  p_token_hash bytea,p_browser_hash bytea,p_device_hash bytea,p_purpose text,p_target text
)
returns table(id text,purpose text,target text,principal_id text,reference_id text,version bigint,expires_at timestamptz)
language sql stable security definer set search_path=identity,pg_temp as $function$
  select preauth.id::text,preauth.purpose,preauth.target,preauth.principal_id,preauth.reference_id,
    preauth.version,preauth.expires_at
  from identity.preauth preauth
  where preauth.token_hash=p_token_hash and preauth.browser_hash=p_browser_hash
    and preauth.device_hash=p_device_hash and preauth.purpose=p_purpose and preauth.target=p_target
    and preauth.state='active' and preauth.consumed_at is null and preauth.expires_at>clock_timestamp()
$function$;

revoke all on function identity.resolve_preauth(bytea,bytea,bytea,text,text) from public;
grant execute on function identity.resolve_preauth(bytea,bytea,bytea,text,text) to shopapp;

select runtime.record_migration_evidence('20260830102000',0,0,0,0,
  'create index concurrently if not exists identity_preauth_resolution_live on identity.preauth(token_hash,purpose,target,state,expires_at);',
  'select purpose,target,state,count(*) from identity.preauth group by purpose,target,state order by purpose,target,state;');
insert into runtime.schemaversion(version,checksum)
values('20260830102000',encode(public.digest('20260830102000_add_security_context','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from identity.preauth where purpose='federationselection'
    and (target is null or reference_id is null or device_hash is null)) then
    raise exception 'FEDERATION_PREAUTH_CONTEXT_INVALID';
  end if;
  if to_regprocedure('identity.resolve_preauth(bytea,bytea,bytea,text,text)') is null then
    raise exception 'PREAUTH_RESOLVER_MISSING';
  end if;
end $assert$;

commit;
