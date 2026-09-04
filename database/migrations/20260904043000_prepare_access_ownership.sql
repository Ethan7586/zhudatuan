begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904042000') then raise exception 'IDEAL_ACCESS_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904043000') then raise exception 'IDEAL_ACCESS_ALREADY_APPLIED'; end if;
  if (select count(*) from information_schema.tables where table_schema='access' and table_name in(
    'ownershiptransfer','ownershipproof','ownershiptimeline','roletemplate','separationrule'))<>5
  then raise exception 'IDEAL_ACCESS_TABLES_MISSING'; end if;
end
$precondition$;

create index if not exists access_ownershipproof_unconsumed on access.ownershipproof(scope_id,transfer_id,stage,id)
  include(actor_membership_id,created_at) where consumed_at is null;

select runtime.record_migration_evidence('20260904043000',
  (select count(*) from access.ownershiptransfer),(select count(*) from access.ownershiptransfer),0,0,
  'select scope_id,state,count(*) from access.ownershiptransfer group by scope_id,state;',
  'select role_id,permission_id,count(*) from access.rolepermission group by role_id,permission_id having count(*)>1;');
insert into runtime.schemaversion(version,checksum)
values('20260904043000',encode(public.digest('20260904043000_prepare_access_ownership','sha256'),'hex'));

do $assert$
begin
  if exists(select scope_id from access.ownershiptransfer where state in('draft','pending') group by scope_id having count(*)>1)
    then raise exception 'IDEAL_OWNERSHIP_ACTIVE_DUPLICATE'; end if;
  if exists(select 1 from access.ownershiptransfer where source_membership_id=target_membership_id)
    then raise exception 'IDEAL_OWNERSHIP_SEPARATION_INVALID'; end if;
  if exists(select role_id,permission_id from access.rolepermission group by role_id,permission_id having count(*)>1)
    then raise exception 'IDEAL_ROLE_PERMISSION_DUPLICATE'; end if;
end
$assert$;

commit;
