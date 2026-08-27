begin;

create table identity.principal(
  id text primary key,
  status text not null check(status in('pending','active','locked','disabled')),
  credential_version bigint not null default 1 check(credential_version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null default 0 check(version>=0)
);
create table identity.credential(
  id text primary key,
  principal_id text not null references identity.principal(id),
  provider text not null,
  subject_hash char(64) not null,
  subject_ciphertext text,
  subject_key_version text,
  secret_hash text,
  encrypted_secret text,
  status text not null check(status in('active','expired','revoked')),
  rotated_at timestamptz,
  created_at timestamptz not null,
  unique(provider,subject_hash),
  check((subject_ciphertext is null)=(subject_key_version is null))
);
create table identity.federatedidentity(
  id text primary key,
  principal_id text references identity.principal(id),
  membership_id text,
  provider text not null,
  application_hash char(64) not null,
  subject_hash char(64) not null,
  union_hash char(64),
  subject_ciphertext text not null,
  subject_key_version text not null,
  status text not null check(status in('unbound','active','revoked')),
  bound_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(provider,application_hash,subject_hash),
  check((status='unbound' and principal_id is null and membership_id is null and bound_at is null)
    or (status in('active','revoked') and principal_id is not null and membership_id is not null and bound_at is not null)),
  check((status='revoked')=(revoked_at is not null))
);
create table identity.wechatgrant(
  id text primary key,
  identity_id text not null references identity.federatedidentity(id) on delete cascade,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null,
  check(expires_at>created_at)
);
create table identity.session(
  id text primary key,
  principal_id text not null references identity.principal(id),
  membership_id text not null,
  token_hash char(64) not null unique,
  credential_version bigint not null,
  access_version bigint not null,
  client text not null,
  ip_hash char(64) not null,
  user_agent text not null,
  device_label text not null,
  assurance_level smallint not null check(assurance_level between 0 and 3),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text,
  last_seen_at timestamptz not null,
  created_at timestamptz not null,
  unique(id,principal_id,membership_id),
  check(expires_at>created_at)
);
create table identity.challenge(
  id text primary key,
  principal_id text references identity.principal(id),
  purpose text not null,
  destination_hash char(64) not null,
  code_hash text not null,
  attempts integer not null default 0 check(attempts between 0 and 10),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null
);
create table identity.challengesecret(
  challenge_id text primary key references identity.challenge(id) on delete cascade,
  code_ciphertext text not null,
  code_key_version text not null,
  destination_ciphertext text not null,
  destination_key_version text not null,
  created_at timestamptz not null
);
create table identity.challengedelivery(
  challenge_id text not null references identity.challenge(id) on delete cascade,
  sequence integer not null,
  provider text not null,
  external_id text,
  state text not null check(state in('sent','failed')),
  error_code text,
  attempted_at timestamptz not null,
  primary key(challenge_id,sequence)
);
create table identity.assurance(
  id text primary key,
  principal_id text not null references identity.principal(id),
  method text not null,
  level smallint not null check(level between 1 and 3),
  evidence_hash char(64) not null,
  verified_at timestamptz not null,
  expires_at timestamptz
);
create table identity.loginattempt(
  subject_hash char(64) not null,
  client_hash char(64) not null,
  window_started_at timestamptz not null,
  failures integer not null check(failures>=0),
  locked_until timestamptz,
  primary key(subject_hash,client_hash)
);
create table identity.registrationpolicy(
  id text primary key,
  version integer not null check(version>0),
  terms_version text not null,
  terms_title text not null,
  terms_body text not null,
  privacy_title text not null,
  privacy_body text not null,
  terms_hash char(64) not null,
  effective_at timestamptz not null,
  retired_at timestamptz,
  unique(version)
);

create table access.permission(
  id text primary key,
  code text not null unique check(code~'^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$'),
  risk text not null check(risk in('low','elevated','high','critical')),
  status text not null check(status in('active','retired'))
);
create table access.role(
  id text primary key,
  scope_id text not null,
  name text not null,
  status text not null check(status in('active','disabled')),
  version bigint not null default 0 check(version>=0),
  unique(scope_id,name)
);
create table access.rolepermission(
  role_id text not null references access.role(id) on delete cascade,
  permission_id text not null references access.permission(id),
  effect text not null check(effect in('allow','deny')),
  primary key(role_id,permission_id,effect)
);
create table access.membershiprole(
  membership_id text not null,
  role_id text not null references access.role(id),
  effective_at timestamptz not null,
  expires_at timestamptz,
  delegated_by text,
  primary key(membership_id,role_id,effective_at)
);
create table access.scopegrant(
  id text primary key,
  membership_id text not null,
  scope_kind text not null check(scope_kind in('platform','distributor','tenant','enterprise','mall','department','supplier','brand','store','owner','self')),
  scope_id text not null,
  scope_path text not null,
  effect text not null check(effect in('allow','deny')),
  effective_at timestamptz not null,
  expires_at timestamptz,
  access_version bigint not null,
  unique(membership_id,scope_kind,scope_id,effect,effective_at)
);
create table access.membershipoverride(
  membership_id text not null,
  permission_id text not null references access.permission(id),
  effect text not null check(effect in('allow','deny')),
  granted_by text not null,
  reason text not null,
  effective_at timestamptz not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  primary key(membership_id,permission_id)
);
create table access.decisionaudit(
  id text primary key,
  actor_id text not null,
  operation text not null,
  resource_id text,
  scope_id text,
  decision text not null check(decision in('allow','deny','challenge','review')),
  reason text not null,
  policy_version text not null,
  trace_id text not null,
  decided_at timestamptz not null
);

do $$ declare item record; begin
  for item in select schemaname,tablename from pg_tables where schemaname in('identity','access') loop
    execute format('alter table %I.%I enable row level security',item.schemaname,item.tablename);
  end loop;
end $$;

commit;
