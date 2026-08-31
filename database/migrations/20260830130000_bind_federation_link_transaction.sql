begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830129000') then
    raise exception 'FEDERATION_LINK_TRANSACTION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830130000') then
    raise exception 'FEDERATION_LINK_TRANSACTION_ALREADY_APPLIED';
  end if;
end $precondition$;

alter table identity.federationtransaction
  add column purpose text not null default 'signin',
  add column link_principal_id text references identity.principal(id),
  add column link_membership_id text references access.membership(id);

alter table identity.federationtransaction
  add constraint federation_transaction_purpose_valid check(purpose in('signin','link')),
  add constraint federation_link_binding_complete check(
    purpose='signin' and link_principal_id is null and link_membership_id is null
    or purpose='link' and link_principal_id is not null and link_membership_id is not null
  );

alter table identity.federationtransaction alter column purpose drop default;

create function identity.validate_federation_link_binding() returns trigger language plpgsql security definer
set search_path=pg_catalog,identity,access as $body$
begin
  if new.purpose='link' and not exists(
    select 1 from access.membership membership
    where membership.id=new.link_membership_id and membership.principal_id=new.link_principal_id and membership.status='active'
  ) then
    raise exception 'FEDERATION_LINK_MEMBERSHIP_INVALID';
  end if;
  return new;
end $body$;

revoke all on function identity.validate_federation_link_binding() from public;

create trigger federation_link_binding_guard before insert or update of purpose,link_principal_id,link_membership_id
on identity.federationtransaction for each row execute function identity.validate_federation_link_binding();

create index identity_federation_link_open
  on identity.federationtransaction(link_principal_id,link_membership_id,expires_at,id)
  where purpose='link' and consumed_at is null;

update runtime.contractcatalog
set checksum='211bf9b16ad30c2e11418911c44950fab3929161f1d1abf83cca58dba73429a2',
    operation_count=239,event_count=79,published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence('20260830130000',
  (select count(*) from information_schema.columns where table_schema='identity' and table_name='federationtransaction'
    and column_name in('purpose','link_principal_id','link_membership_id')),
  3,0,0,
  'select purpose,count(*) from identity.federationtransaction group by purpose order by purpose;',
  'select id,purpose,status,expires_at from identity.federationtransaction where purpose=''link'' and consumed_at is null;');

insert into runtime.schemaversion(version,checksum)
values('20260830130000','211bf9b16ad30c2e11418911c44950fab3929161f1d1abf83cca58dba73429a2');

do $assert$ begin
  if (select count(*) from information_schema.columns where table_schema='identity' and table_name='federationtransaction'
    and column_name in('purpose','link_principal_id','link_membership_id'))<>3 then
    raise exception 'FEDERATION_LINK_TRANSACTION_COLUMNS_INVALID';
  end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active'
    and checksum='211bf9b16ad30c2e11418911c44950fab3929161f1d1abf83cca58dba73429a2'
    and operation_count=239 and event_count=79) then
    raise exception 'FEDERATION_LINK_CONTRACT_IDENTITY_INVALID';
  end if;
end $assert$;

commit;
