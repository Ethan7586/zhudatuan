begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830114000') then
    raise exception 'CAMPAIGN_SESSION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830115000') then
    raise exception 'CAMPAIGN_SESSION_ALREADY_APPLIED';
  end if;
end $precondition$;

alter table identity.invitationreceipt alter column session_id drop not null;
create function identity.protect_invitation_receipt_shape() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $function$
declare invitation_kind text;
begin
  select invitation.kind into invitation_kind from identity.invitation invitation where invitation.id=new.invitation_id;
  if invitation_kind is null
    or (invitation_kind='campaign' and new.session_id is not null)
    or (invitation_kind<>'campaign' and new.session_id is null) then
    raise exception 'INVITATION_RECEIPT_SHAPE_INVALID';
  end if;
  return new;
end $function$;
revoke all on function identity.protect_invitation_receipt_shape() from public;
create trigger identity_invitation_receipt_shape before insert on identity.invitationreceipt
for each row execute function identity.protect_invitation_receipt_shape();

select runtime.record_migration_evidence('20260830115000',1,1,0,0,
  'select 1;',
  'select invitation.kind,count(*),count(receipt.session_id) from identity.invitationreceipt receipt join identity.invitation invitation on invitation.id=receipt.invitation_id group by invitation.kind order by invitation.kind;');
insert into runtime.schemaversion(version,checksum)
values('20260830115000',encode(public.digest('20260830115000_separate_campaign_session','sha256'),'hex'));

do $assert$ begin
  if not exists(select 1 from information_schema.columns where table_schema='identity' and table_name='invitationreceipt'
    and column_name='session_id' and is_nullable='YES') then raise exception 'CAMPAIGN_RECEIPT_SESSION_NOT_NULL'; end if;
  if not exists(select 1 from pg_trigger where tgname='identity_invitation_receipt_shape' and not tgisinternal) then
    raise exception 'CAMPAIGN_RECEIPT_SHAPE_TRIGGER_MISSING';
  end if;
end $assert$;

commit;
