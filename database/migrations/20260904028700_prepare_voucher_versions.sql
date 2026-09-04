begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904028600') then raise exception 'VOUCHER_VERSION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904028700') then raise exception 'VOUCHER_VERSION_ALREADY_APPLIED'; end if;
  if exists(select 1 from voucher.productversion version join voucher.product product on product.id=version.product_id where version.scope_id<>product.scope_id) then
    raise exception 'VOUCHER_VERSION_SCOPE_EVIDENCE_REQUIRED';
  end if;
end $precondition$;

alter table voucher.product add constraint voucher_product_identity unique(id,scope_id);
alter table voucher.productversion add constraint voucher_productversion_scope foreign key(product_id,scope_id) references voucher.product(id,scope_id);

-- One projection for every product writer, including pool attachment and state
-- changes. Old history is not rewritten or invented from today's configuration.
create function voucher.product_snapshot(product voucher.product) returns jsonb language sql immutable set search_path=voucher,pg_temp set timezone='UTC' as $function$
  select jsonb_build_object('id',product.id,'number',product.number,'scopeId',product.scope_id,'customer',product.customer_id,
    'name',product.name,'faceMinor',product.face_minor,'currency',product.currency,'qualification',product.qualification_id,
    'pool',product.pool_id,'validity',jsonb_build_object('startsAt',product.starts_at,'expiresAt',product.expires_at),
    'activation',product.activation,'approvalRequired',product.approval_required,'state',product.state,'version',product.version);
$function$;

-- Materialize the observed source and compare exactly the rows inserted by this
-- statement. Existing historical versions are outside this capture's totals.
create temporary table voucherproductcapture on commit drop as
with source as materialized (
  select product.id,product.scope_id,product.version,product.face_minor,voucher.product_snapshot(product) snapshot
  from voucher.product product where not exists(select 1 from voucher.productversion version where version.product_id=product.id and version.version=product.version)
), captured as (
  insert into voucher.productversion(product_id,scope_id,version,snapshot,changed_by,changed_at)
  select id,scope_id,version,snapshot,'system:versioncapture',clock_timestamp() from source
  returning product_id,scope_id,version,snapshot
)
select (select count(*) from source) source_rows,count(*) target_rows,
  (select coalesce(sum(face_minor),0) from source) source_minor,
  coalesce(sum((captured.snapshot->>'faceMinor')::numeric),0) target_minor
from captured join source on source.id=captured.product_id and source.scope_id=captured.scope_id
  and source.version=captured.version and source.snapshot=captured.snapshot;

create function voucher.record_product_version() returns trigger language plpgsql security definer set search_path=voucher,pg_temp as $function$
declare actor text:=nullif(current_setting('app.actor_id',true),'');
begin
  if actor is null then raise exception 'VOUCHER_VERSION_ACTOR_REQUIRED'; end if;
  insert into voucher.productversion(product_id,scope_id,version,snapshot,changed_by,changed_at)
    values(new.id,new.scope_id,new.version,voucher.product_snapshot(new),actor,clock_timestamp());
  return new;
end
$function$;
create trigger voucherproductversion after insert or update on voucher.product for each row execute function voucher.record_product_version();
create trigger voucherproductversionimmutable before update or delete on voucher.productversion for each row execute function voucher.guard_snapshot_item();

revoke insert,update,delete on voucher.productversion from shopapp,shopjob;
revoke all on function voucher.record_product_version() from public;
revoke all on function voucher.product_snapshot(voucher.product) from public;

select runtime.record_migration_evidence('20260904028700',source_rows,target_rows,source_minor,target_minor,
  'select product_id,min(version),max(version),count(*) from voucher.productversion group by product_id;',
  'select product.id from voucher.product product where not exists(select 1 from voucher.productversion version where version.product_id=product.id and version.scope_id=product.scope_id and version.version=product.version);')
from voucherproductcapture;
insert into runtime.schemaversion(version,checksum)
values('20260904028700',encode(public.digest('20260904028700_prepare_voucher_versions','sha256'),'hex'));

do $assert$ begin
  if has_table_privilege('shopapp','voucher.productversion','insert') or has_table_privilege('shopjob','voucher.productversion','update')
    or exists(select 1 from voucher.product product where not exists(select 1 from voucher.productversion version where version.product_id=product.id and version.scope_id=product.scope_id and version.version=product.version)) then
    raise exception 'VOUCHER_PRODUCT_VERSION_BOUNDARY_INVALID';
  end if;
end $assert$;

commit;
