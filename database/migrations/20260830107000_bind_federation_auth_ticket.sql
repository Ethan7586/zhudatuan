begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830106000') then
    raise exception 'FEDERATION_AUTH_TICKET_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830107000') then
    raise exception 'FEDERATION_AUTH_TICKET_ALREADY_APPLIED';
  end if;
end $precondition$;

alter table identity.federationtransaction add column auth_state_hash char(64) not null default repeat('0',64);
alter table identity.federationtransaction add column auth_nonce_hash char(64) not null default repeat('0',64);
alter table identity.federationtransaction add column auth_pkce_challenge char(43) not null default repeat('0',43);
alter table identity.federationtransaction alter column auth_state_hash drop default;
alter table identity.federationtransaction alter column auth_nonce_hash drop default;
alter table identity.federationtransaction alter column auth_pkce_challenge drop default;
alter table identity.federationtransaction add constraint federation_auth_state_hash_valid
  check(auth_state_hash~'^[0-9a-f]{64}$');
alter table identity.federationtransaction add constraint federation_auth_nonce_hash_valid
  check(auth_nonce_hash~'^[0-9a-f]{64}$');
alter table identity.federationtransaction add constraint federation_auth_pkce_valid
  check(auth_pkce_challenge~'^[A-Za-z0-9_-]{43}$');

select runtime.record_migration_evidence('20260830107000',
  (select count(*) from identity.federationtransaction),(select count(*) from identity.federationtransaction),0,0,
  'create index concurrently if not exists identity_federationtransaction_auth_live on identity.federationtransaction(auth_state_hash,status,expires_at);',
  'select status,count(*) from identity.federationtransaction group by status order by status;');
insert into runtime.schemaversion(version,checksum)
values('20260830107000',encode(public.digest('20260830107000_bind_federation_auth_ticket','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from identity.federationtransaction where auth_state_hash is null or auth_nonce_hash is null
    or auth_pkce_challenge is null) then raise exception 'FEDERATION_AUTH_TICKET_BINDING_INVALID'; end if;
end $assert$;

commit;
