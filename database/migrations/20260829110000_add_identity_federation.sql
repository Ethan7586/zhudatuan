begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829109000') then raise exception 'IDENTITY_FEDERATION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829110000') then raise exception 'IDENTITY_FEDERATION_ALREADY_APPLIED'; end if;
end $precondition$;

create table identity.provider(
  id uuid primary key,
  tenant_id uuid not null,
  type text not null check(type in('wechat','wecomcorp','wecomsuite','oidc')),
  provider_tenant_hash bytea not null,
  issuer_hash bytea,
  client_id_hash bytea not null,
  secret_ref text not null check(secret_ref~'^[a-z][a-z0-9./]{2,127}$'),
  redirect_uri text not null check(redirect_uri~'^https://'),
  scopes text[] not null default array[]::text[],
  status text not null check(status in('draft','enabled','disabled','revoked')),
  version bigint not null default 0 check(version>=0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check(cardinality(scopes)<=32)
);
create table identity.federationtransaction(
  id uuid primary key,
  provider_id uuid not null references identity.provider(id),
  state_hash bytea not null unique,
  nonce_hash bytea not null,
  pkce_challenge text not null check(length(pkce_challenge) between 43 and 128),
  verifier_ciphertext text not null,
  browser_hash bytea not null,
  return_target_hash bytea not null,
  return_target_ref text not null,
  target text not null check(target in('console','storefront')),
  risk_hash bytea not null,
  status text not null check(status in('created','redirected','callbackreceived','verified','selectionrequired','linkrequired','completed','expired','rejected')),
  version bigint not null default 0 check(version>=0),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check(expires_at>created_at and expires_at<=created_at+interval '10 minutes'),
  check(consumed_at is null or consumed_at>=created_at)
);
create table identity.preauth(
  id uuid primary key,
  transaction_id uuid not null unique references identity.federationtransaction(id),
  principal_id text not null references identity.principal(id),
  token_hash bytea not null unique,
  candidate_hash bytea not null,
  candidate_memberships jsonb not null check(jsonb_typeof(candidate_memberships)='array'),
  browser_hash bytea not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check(expires_at>created_at and expires_at<=created_at+interval '5 minutes'),
  check(consumed_at is null or consumed_at>=created_at)
);
create table identity.linkcase(
  id uuid primary key,
  provider_id uuid not null references identity.provider(id),
  transaction_id uuid references identity.federationtransaction(id),
  tenant_id uuid not null,
  subject_hash bytea not null,
  candidate_principal_id text references identity.principal(id),
  candidate_membership_id text,
  reason text not null check(reason in('unlinked','ambiguous','principalconflict','tenantunknown','subjectconflict')),
  evidence_ciphertext text,
  status text not null check(status in('open','verified','rejected','expired')),
  decision_by text,
  checked_by text,
  audit_id text,
  version bigint not null default 0 check(version>=0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  decided_at timestamptz,
  check(status='open' and decided_at is null or status<>'open' and decided_at is not null),
  check(checked_by is null or checked_by<>decision_by)
);
create table identity.providersecretrotation(
  id uuid primary key,
  provider_id uuid not null references identity.provider(id),
  old_ref text not null check(old_ref~'^[a-z][a-z0-9./]{2,127}$'),
  new_ref text not null check(new_ref~'^[a-z][a-z0-9./]{2,127}$'),
  state text not null check(state in('pending','verified','active','failed','retired')),
  version bigint not null default 0 check(version>=0),
  activated_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check(old_ref<>new_ref)
);

alter table identity.federatedidentity add column provider_instance_id uuid references identity.provider(id);
alter table identity.federatedidentity add column provider_tenant_hash bytea;
alter table identity.federatedidentity add column normalized_subject_hash bytea;
alter table identity.federatedidentity add column linked_at timestamptz;
alter table identity.federatedidentity add column verified_at timestamptz;
alter table identity.federatedidentity add column last_seen_at timestamptz;
alter table identity.federatedidentity add column source text not null default 'migration' check(source in('login','directory','manual','migration'));
alter table identity.federatedidentity add column version bigint not null default 0 check(version>=0);

select runtime.record_migration_evidence('20260829110000',
  (select count(*) from identity.federatedidentity),(select count(*) from identity.federatedidentity),0,0,
  'create unique index concurrently if not exists identity_provider_active_live on identity.provider(tenant_id,type,provider_tenant_hash,client_id_hash) where status<>''revoked'';',
  'select id,provider,subject_hash from identity.federatedidentity where provider_instance_id is null;');
insert into runtime.schemaversion(version,checksum) values('20260829110000',encode(public.digest('20260829110000_add_identity_federation','sha256'),'hex'));

commit;
