begin;

create table identity.authticket(
  id text primary key,
  session_id text not null references identity.session(id) on delete cascade,
  token_hash char(64) not null unique check(token_hash~'^[0-9a-f]{64}$'),
  state_hash char(64) not null check(state_hash~'^[0-9a-f]{64}$'),
  nonce_hash char(64) not null check(nonce_hash~'^[0-9a-f]{64}$'),
  pkce_challenge text not null check(pkce_challenge~'^[A-Za-z0-9_-]{43}$'),
  target text not null check(target in('console','storefront','store','supplier')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null,
  check(expires_at>created_at),
  check(consumed_at is null or consumed_at>=created_at)
);
create index identity_authticket_expiry on identity.authticket(expires_at,id) where consumed_at is null;
alter table identity.authticket enable row level security;
create policy appscope on identity.authticket for all to shopapp
  using(current_setting('app.workload',true)='api') with check(current_setting('app.workload',true)='api');
create policy jobscope on identity.authticket for all to shopjob using(true) with check(true);
grant select,insert,update,delete on identity.authticket to shopapp,shopjob;

insert into runtime.operation(id,owner,method,path,contract_version)
values('identity.tickets.exchange','identity','POST','/api/v1/identity/tickets/exchange','1.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;

insert into capability.capability(id,kind,name,version,status)
values('identity.tickets.exchange','operation','identity.tickets.exchange',1,'active')
on conflict(id) do update set status=excluded.status;

insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('identity.tickets.exchange','identity.tickets.exchange',null,'public')
on conflict(operation_id) do update set capability_id=excluded.capability_id,permission_code=null,audience='public';

insert into runtime.schemaversion(version,checksum)
values('20260821035000','894ec9f2c9edbd56d2ae42a734c1a2b3312050602b74c84b8b248302f5b3ceda');

do $assert$
begin
  if (select count(*) from runtime.operation)<>154 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if to_regclass('identity.authticket') is null then raise exception 'AUTH_TICKET_TABLE_MISSING'; end if;
  if not exists(select 1 from capability.operation where operation_id='identity.tickets.exchange' and audience='public') then
    raise exception 'AUTH_TICKET_CAPABILITY_MISSING';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821035000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
