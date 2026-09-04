begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904028800') then raise exception 'VOUCHER_TENDER_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904028900') then raise exception 'VOUCHER_TENDER_ALREADY_APPLIED'; end if;
end $precondition$;

alter table voucher.voucher add constraint voucher_identity unique(id,scope_id);
alter table voucher.tenderhold add constraint voucher_hold_identity unique(id,scope_id,voucher_id);
alter table voucher.tenderhold add constraint voucher_hold_scope foreign key(voucher_id,scope_id) references voucher.voucher(id,scope_id) not valid;
alter table voucher.tenderhold validate constraint voucher_hold_scope;
alter table voucher.redemption add constraint voucher_redemption_scope foreign key(voucher_id,scope_id) references voucher.voucher(id,scope_id) not valid;
alter table voucher.redemption validate constraint voucher_redemption_scope;
alter table voucher.redemption add constraint voucher_redemption_hold_scope foreign key(hold_id,scope_id,voucher_id) references voucher.tenderhold(id,scope_id,voucher_id) not valid;
alter table voucher.redemption validate constraint voucher_redemption_hold_scope;

-- A hold's parent and monetary/expiry terms never change after creation. Readers
-- can safely resolve its parent without acquiring the child lock first.
create or replace function voucher.guard_hold_transition() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if row(new.id,new.scope_id,new.voucher_id,new.owner_id,new.amount_minor,new.expires_at,new.idempotency_key,new.created_at)
    is distinct from row(old.id,old.scope_id,old.voucher_id,old.owner_id,old.amount_minor,old.expires_at,old.idempotency_key,old.created_at) then
    raise exception 'VOUCHER_HOLD_FROZEN';
  end if;
  if old.state<>'active' then raise exception 'VOUCHER_HOLD_FINAL'; end if;
  if new.state not in('consumed','released','expired') then raise exception 'VOUCHER_HOLD_BACKWARD'; end if;
  if new.version<>old.version+1 then raise exception 'VOUCHER_VERSION_INVALID'; end if;
  new.updated_at=clock_timestamp(); return new;
end $function$;

create function voucher.guard_hold_creation() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
declare parent voucher.voucher%rowtype;
begin
  select * into parent from voucher.voucher where id=new.voucher_id and scope_id=new.scope_id for update;
  if not found or parent.state<>'active' or new.state<>'active' or new.amount_minor>parent.remaining_minor
    or new.expires_at>parent.expires_at or new.expires_at<=new.created_at or new.created_at<parent.starts_at then
    raise exception 'VOUCHER_HOLD_CONFLICT';
  end if;
  return new;
end $function$;
create trigger voucherholdcreation before insert on voucher.tenderhold for each row execute function voucher.guard_hold_creation();
revoke all on function voucher.guard_hold_creation() from public;

select runtime.record_migration_evidence('20260904028900',0,0,0,0,
  'select voucher_id,count(*) from voucher.tenderhold where state=''active'' group by voucher_id having count(*)>1;',
  'select hold.id from voucher.tenderhold hold join voucher.voucher voucher on voucher.id=hold.voucher_id where hold.scope_id<>voucher.scope_id;');
insert into runtime.schemaversion(version,checksum)
values('20260904028900',encode(public.digest('20260904028900_prepare_voucher_tenders','sha256'),'hex'));

commit;
