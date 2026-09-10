begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904019000') then raise exception 'CATALOG_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904020000') then raise exception 'CATALOG_ALREADY_APPLIED'; end if;
end $precondition$;

alter table runtime.import_chunks add column payload jsonb;
update runtime.import_chunks set payload='[]'::jsonb where payload is null;
alter table runtime.import_chunks alter column payload set not null;
alter table runtime.import_chunks add constraint runtime_import_chunk_payload check(jsonb_typeof(payload)='array' and pg_column_size(payload)<=16777216);

create table runtime.import_errors(
  import_id text not null references runtime.imports(id) on delete cascade,
  scope_id text not null,
  row_number bigint not null check(row_number>1),
  reason_code text not null check(length(reason_code) between 1 and 128),
  field text,
  detail jsonb not null,
  primary key(import_id,row_number,reason_code)
);
create index runtime_import_errors_report on runtime.import_errors(import_id,row_number,reason_code) include(field);

alter table runtime.import_errors enable row level security;
alter table runtime.import_errors force row level security;
create policy migrationaccess on runtime.import_errors for all to shopmigration using(true) with check(true);
create policy importerrorsapp on runtime.import_errors for select to shopapp using(access.scope_allowed(scope_id));
create policy importerrorsjob on runtime.import_errors for all to shopjob using(true) with check(true);
revoke all on runtime.import_errors from public;
grant select on runtime.import_errors to shopapp;
grant select,insert,update,delete on runtime.import_errors to shopjob;

alter table catalog.sku add column scope_id text;
update catalog.sku sku set scope_id=product.scope_id from catalog.product product where product.id=sku.product_id;
alter table catalog.sku alter column scope_id set not null;
alter table catalog.sku drop constraint sku_code_key;
alter table catalog.sku add constraint catalog_sku_scope_code unique(scope_id,code);
create index catalog_sku_product on catalog.sku(product_id,id) include(code,status,version);

update catalog.product set version=1 where version=0;
update catalog.sku set version=1 where version=0;
update catalog.pool set version=1 where version=0;
update catalog.listing set version=1 where version=0;
alter table catalog.product add constraint catalog_product_version_positive check(version>0) not valid;
alter table catalog.sku add constraint catalog_sku_version_positive check(version>0) not valid;
alter table catalog.pool add constraint catalog_pool_version_positive check(version>0) not valid;
alter table catalog.listing add constraint catalog_listing_version_positive check(version>0) not valid;
alter table catalog.product validate constraint catalog_product_version_positive;
alter table catalog.sku validate constraint catalog_sku_version_positive;
alter table catalog.pool validate constraint catalog_pool_version_positive;
alter table catalog.listing validate constraint catalog_listing_version_positive;

do $duplicatepayload$
begin
  if exists(
    select 1
    from catalog.importjob job
    join catalog.importrow row on row.job_id=job.id
    group by job.scope_id,job.sha256,row.row_number
    having count(distinct row.payload::text)>1
  ) then
    raise exception 'CATALOG_IMPORT_DUPLICATE_PAYLOAD_CONFLICT';
  end if;
end
$duplicatepayload$;

create temporary table catalogimportmap on commit drop as
with ranked as (
  select source.id,source.scope_id,source.sha256,
    first_value(source.id) over(
      partition by source.scope_id,source.sha256
      order by
        (source.state='completed' and source.failure_count=0 and source.success_count=source.total_count) desc,
        source.cursor_value desc,source.success_count desc,source.failure_count asc,source.updated_at desc,source.id desc
    ) canonical_id
  from catalog.importjob source
)
select ranked.id source_id,'import:'||split_part(ranked.canonical_id,':',2) target_id,
  ranked.id=ranked.canonical_id canonical
from ranked;
create unique index catalogimportmap_source on catalogimportmap(source_id);
create index catalogimportmap_target on catalogimportmap(target_id,canonical);

insert into runtime.imports(id,tenant_id,scope_id,owner,kind,object_key,file_hash,file_name,media_type,size_bytes,state,
  rows_total,rows_processed,rows_succeeded,rows_failed,checkpoint,error_report_key,idempotency_key,version,created_by,updated_by,
  created_at,updated_at,retention_until)
select mapping.target_id,source.scope_id,source.scope_id,'catalog','product',source.object_ref,source.sha256,
  'catalog.csv','text/csv',1,case source.state when 'validating' then 'preflight' when 'reporting' then 'running'
    when 'completed' then 'succeeded' else source.state end,source.total_count,source.cursor_value,source.success_count,source.failure_count,
  source.validation_summary||jsonb_build_object('migratedFrom',source.id,'sizeBackfill','unknown')||
    case when source.last_error is null then '{}'::jsonb else jsonb_build_object('lastError',source.last_error) end||
    case when source.report_sha256 is null then '{}'::jsonb else jsonb_build_object('reportSha256',source.report_sha256,'reportSize',source.report_size) end||
    jsonb_build_object(
      'legacyAttempts',(
        select jsonb_agg(
          jsonb_build_object(
            'id',attempt.id,'state',attempt.state,'total',attempt.total_count,'processed',attempt.cursor_value,
            'succeeded',attempt.success_count,'failed',attempt.failure_count,'validation',attempt.validation_summary,
            'lastError',attempt.last_error,'reportObjectRef',attempt.report_object_ref,
            'reportSha256',attempt.report_sha256,'reportSize',attempt.report_size,
            'createdAt',attempt.created_at,'updatedAt',attempt.updated_at,
            'errors',(
              select coalesce(jsonb_agg(jsonb_build_object(
                'row',error.row_number,'reason',error.reason_code,'field',error.field,'detail',error.detail
              ) order by error.row_number,error.reason_code),'[]'::jsonb)
              from catalog.importerror error where error.job_id=attempt.id
            )
          ) order by attempt.created_at,attempt.id
        )
        from catalog.importjob attempt
        where attempt.scope_id=source.scope_id and attempt.sha256=source.sha256
      )
    ),
  source.report_object_ref,mapping.target_id,greatest(source.cursor_value,1),'migration:catalog','migration:catalog',
  source.created_at,source.updated_at,greatest(source.updated_at,clock_timestamp())+interval '90 days'
from catalog.importjob source
join catalogimportmap mapping on mapping.source_id=source.id and mapping.canonical
on conflict(id) do nothing;

insert into runtime.import_chunks(id,tenant_id,scope_id,import_id,sequence,row_start,row_end,payload_hash,payload,state,
  fencing_token,checkpoint,error_count,version,created_at,updated_at)
select 'importchunk:'||split_part(mapping.target_id,':',2)||':'||((row.row_number-2)/500)::integer,job.scope_id,job.scope_id,
  mapping.target_id,((row.row_number-2)/500)::integer,min(row.row_number),max(row.row_number),
  encode(public.digest(jsonb_agg(jsonb_build_object('row',row.row_number,'payload',row.payload) order by row.row_number)::text,'sha256'),'hex'),
  jsonb_agg(jsonb_build_object('row',row.row_number,'payload',row.payload) order by row.row_number),
  case when max(row.row_number)-1<=job.cursor_value then 'succeeded' else 'pending' end,null,'{}'::jsonb,
  0,1,job.created_at,job.updated_at
from catalog.importrow row
join catalog.importjob job on job.id=row.job_id
join catalogimportmap mapping on mapping.source_id=job.id and mapping.canonical
group by mapping.target_id,job.scope_id,job.cursor_value,job.created_at,job.updated_at,((row.row_number-2)/500)::integer;

insert into runtime.import_errors(import_id,scope_id,row_number,reason_code,field,detail)
select mapping.target_id,error.scope_id,error.row_number,error.reason_code,error.field,to_jsonb(error.detail)
from catalog.importerror error
join catalogimportmap mapping on mapping.source_id=error.job_id and mapping.canonical;

update runtime.job target set payload=jsonb_set(target.payload,'{import}',to_jsonb(mapping.target_id))
from catalogimportmap mapping
where target.kind='catalogimport' and target.payload->>'import'=mapping.source_id;

do $importaudit$
begin
  if (select count(*) from catalogimportmap where canonical)<>(select count(distinct target_id) from catalogimportmap) then
    raise exception 'CATALOG_IMPORT_CANONICAL_MAPPING_INVALID';
  end if;
  if (select count(*) from catalogimportmap)<>(
    select coalesce(sum(jsonb_array_length(import.checkpoint->'legacyAttempts')),0)
    from runtime.imports import
    where exists(select 1 from catalogimportmap mapping where mapping.target_id=import.id)
  ) then
    raise exception 'CATALOG_IMPORT_ATTEMPT_AUDIT_MISMATCH';
  end if;
end
$importaudit$;

do $scope$
declare source text;
begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into source;
  source=replace(source,'select scope_id into resolved from catalog.importjob where id=p_resource','select scope_id into resolved from runtime.imports where id=p_resource');
  if source like '%catalog.importjob%' then raise exception 'CATALOG_IMPORT_SCOPE_CUTOVER_FAILED'; end if;
  execute source;
end
$scope$;

drop table catalog.importrow;
drop table catalog.importerror;
drop table catalog.importjob;

create function catalog.assert_listing_write() returns trigger language plpgsql security definer
set search_path=catalog,qualification,pricing,inventory,pg_temp set row_security=off as $function$
declare productrow catalog.product%rowtype;
begin
  select product.* into productrow from catalog.sku sku join catalog.product product on product.id=sku.product_id where sku.id=new.sku_id;
  if productrow.id is null then raise exception 'CATALOG_PRODUCT_REQUIRED'; end if;
  if tg_op='INSERT' and productrow.status='archived' then raise exception 'CATALOG_ARCHIVED_PRODUCT_LISTING_FORBIDDEN'; end if;
  if new.status<>'published' then return new; end if;
  if productrow.status<>'active' then raise exception 'CATALOG_PRODUCT_NOT_ACTIVE'; end if;
  if not exists(select 1 from catalog.sku where id=new.sku_id and status='active') then raise exception 'CATALOG_SKU_NOT_ACTIVE'; end if;
  if not exists(select 1 from catalog.pool pool where pool.id=new.pool_id and pool.status='active'
    and (pool.scope_id=new.scope_id or exists(select 1 from catalog.poolbinding binding where binding.pool_id=pool.id and binding.mall_id=new.scope_id
      and binding.status='active' and (binding.effective_at is null or binding.effective_at<=clock_timestamp())
      and (binding.expires_at is null or binding.expires_at>clock_timestamp())))) then raise exception 'CATALOG_POOL_NOT_AVAILABLE'; end if;
  if not exists(select 1 from pricing.price price join pricing.pricebook book on book.id=price.book_id where price.sku_id=new.sku_id
    and book.scope_id=new.scope_id and book.status='active' and price.effective_at<=clock_timestamp()
    and (price.expires_at is null or price.expires_at>clock_timestamp())) then raise exception 'CATALOG_PRICE_REQUIRED'; end if;
  if not exists(select 1 from inventory.stockitem stock where stock.sku_id=new.sku_id and stock.scope_id=new.scope_id
    and stock.status='active' and stock.onhand>stock.safety) then raise exception 'CATALOG_INVENTORY_REQUIRED'; end if;
  if productrow.owner_partner_id is not null and not exists(select 1 from catalog.sourcelisting source where source.sku_id=new.sku_id
    and source.status='mapped') then raise exception 'CATALOG_CHANNEL_REQUIRED'; end if;
  if exists(
    select 1 from qualification.qualificationcase target where target.scope_id=new.scope_id and(
      (target.subject_kind='product' and target.subject_id=productrow.id)
      or (target.subject_kind='category' and target.subject_id=productrow.category_id)
      or (target.subject_kind='partner' and target.subject_id=productrow.owner_partner_id)
      or (target.subject_kind='region' and coalesce(productrow.attributes->'regionIds','[]'::jsonb)?target.subject_id)
      or exists(select 1 from qualification.casescope applicable where applicable.case_id=target.id and(
        (applicable.kind='product' and applicable.target_id=productrow.id)
        or (applicable.kind='category' and applicable.target_id=productrow.category_id)
        or (applicable.kind='partner' and applicable.target_id=productrow.owner_partner_id)
        or (applicable.kind='region' and coalesce(productrow.attributes->'regionIds','[]'::jsonb)?applicable.target_id)))
    ) and not exists(select 1 from qualification.qualificationcase newer where newer.scope_id=target.scope_id
      and newer.subject_kind=target.subject_kind and newer.subject_id=target.subject_id
      and (newer.updated_at,newer.id)>(target.updated_at,target.id))
    and (target.state<>'published' or target.effective_at>clock_timestamp() or target.expires_at<=clock_timestamp())
  ) then raise exception 'CATALOG_QUALIFICATION_REQUIRED'; end if;
  return new;
end
$function$;
create trigger cataloglistingwrite before insert or update of status,sku_id,pool_id,scope_id on catalog.listing
for each row execute function catalog.assert_listing_write();

create function catalog.unpublish_archived_product() returns trigger language plpgsql security definer
set search_path=catalog,pg_temp set row_security=off as $function$
begin
  if new.status='archived' and old.status<>'archived' then
    update catalog.listing listing set status='unpublished',expires_at=clock_timestamp(),version=listing.version+1,updated_at=clock_timestamp()
    from catalog.sku sku where sku.id=listing.sku_id and sku.product_id=new.id and listing.status='published';
  end if;
  return null;
end
$function$;
create trigger catalogproductarchive after update of status on catalog.product for each row execute function catalog.unpublish_archived_product();

revoke all on function catalog.assert_listing_write(),catalog.unpublish_archived_product() from public;

update capability.capability set version=2 where id in('catalog.product.detail.read','catalog.listings.publish','catalog.listings.batch');
insert into runtime.event(type,version,owner,schema_ref) values
  ('catalog.product.created',1,'catalog','contract://events/catalog.product.created/v1'),
  ('catalog.product.updated',1,'catalog','contract://events/catalog.product.updated/v1'),
  ('catalog.product.archived',1,'catalog','contract://events/catalog.product.archived/v1');

update runtime.contractcatalog set checksum='51ec81e4868a83b618ca79fc9bec6dc8fd77616815ada3c63203fc69cc21d382',operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904020000',(select count(*) from runtime.imports where owner='catalog'),(select count(*) from runtime.imports where owner='catalog'),0,0,
  'create index concurrently if not exists catalog_listing_publication on catalog.listing(scope_id,status,updated_at desc,id) include(sku_id,pool_id,version);',
  'select state,count(*) from runtime.imports where owner=''catalog'' group by state;'
);
insert into runtime.schemaversion(version,checksum) values('20260904020000','51ec81e4868a83b618ca79fc9bec6dc8fd77616815ada3c63203fc69cc21d382');

do $assert$ begin
  if exists(select 1 from information_schema.tables where table_schema='catalog' and table_name in('importjob','importrow','importerror')) then raise exception 'CATALOG_PRIVATE_IMPORT_TABLE_REMAINS'; end if;
  if exists(select 1 from runtime.imports where owner='catalog' and rows_processed<>rows_succeeded+rows_failed) then raise exception 'CATALOG_IMPORT_PROGRESS_INVALID'; end if;
  if (select count(*) from runtime.event)<>127 then raise exception 'CATALOG_EVENT_COUNT_INVALID'; end if;
  if exists(select scope_id,code from catalog.sku group by scope_id,code having count(*)>1) then raise exception 'CATALOG_SKU_SCOPE_CODE_DUPLICATE'; end if;
end $assert$;

commit;
