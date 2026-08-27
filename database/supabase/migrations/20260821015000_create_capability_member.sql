begin;

create table capability.capability(
  id text primary key,
  kind text not null check(kind in('operation','feature','uiblock','quota')),
  name text not null,
  version integer not null check(version>0),
  status text not null check(status in('active','retired')),
  unique(kind,name,version)
);
create table capability.dependency(
  capability_id text not null references capability.capability(id),
  depends_on_id text not null references capability.capability(id),
  primary key(capability_id,depends_on_id),
  check(capability_id<>depends_on_id)
);
create table capability.entitlement(
  id text primary key,
  scope_id text not null,
  capability_id text not null references capability.capability(id),
  state text not null check(state in('enabled','disabled')),
  quota bigint check(quota is null or quota>=0),
  effective_at timestamptz not null,
  expires_at timestamptz,
  version bigint not null default 0,
  unique(scope_id,capability_id,effective_at)
);
create table capability.operation(
  operation_id text primary key references runtime.operation(id) on delete cascade,
  capability_id text not null unique references capability.capability(id) on delete cascade,
  permission_code text,
  audience text not null check(audience in('public','member','operator','provider'))
);

create table member.profile(
  id text primary key,
  principal_id text not null unique,
  display_name text not null,
  mobile_ciphertext text,
  mobile_token char(64),
  email_ciphertext text,
  email_token char(64),
  status text not null check(status in('pending','active','disabled')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null default 0
);
create table member.membership(
  id text primary key,
  member_id text not null references member.profile(id),
  organization_id text not null,
  client text not null check(client in('storefront','operator','store','supplier')),
  employee_no text,
  status text not null check(status in('invited','active','suspended','left')),
  access_version bigint not null default 1 check(access_version>0),
  joined_at timestamptz,
  left_at timestamptz,
  unique(member_id,organization_id,client)
);
create table member.invite(
  id text primary key,
  organization_id text not null,
  destination_hash char(64) not null,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by text not null,
  role_id text not null,
  allowed_destination_hash char(64),
  max_uses integer not null check(max_uses>0),
  use_count integer not null check(use_count between 0 and max_uses),
  effective_at timestamptz not null,
  status text not null check(status in('active','disabled','expired'))
);
create table member.importjob(
  id text primary key,
  organization_id text not null,
  object_ref text not null,
  sha256 char(64) not null,
  state text not null check(state in('uploaded','validating','ready','running','completed','failed','cancelled')),
  cursor_value text,
  total_count integer not null default 0 check(total_count>=0),
  success_count integer not null default 0 check(success_count>=0),
  failure_count integer not null default 0 check(failure_count>=0),
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create table member.importerror(
  job_id text not null references member.importjob(id) on delete cascade,
  row_number integer not null check(row_number>0),
  reason_code text not null,
  field text,
  detail text not null,
  primary key(job_id,row_number,reason_code)
);
alter table identity.session add constraint session_membership_fk foreign key(membership_id) references member.membership(id);

do $$ declare item record; begin
  for item in select schemaname,tablename from pg_tables where schemaname in('capability','member') loop execute format('alter table %I.%I enable row level security',item.schemaname,item.tablename); end loop;
end $$;
commit;
