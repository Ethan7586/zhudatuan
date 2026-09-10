begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904058000') then raise exception 'IDEAL_REFERENCE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904059000') then raise exception 'IDEAL_REFERENCE_ALREADY_APPLIED'; end if;
end
$precondition$;

create table runtime.businessreference(
  tenant_id text not null,
  scope_id text not null,
  aggregate_type text not null check(aggregate_type~'^[a-z]+\.[a-z]+$'),
  internal_id text not null,
  business_number text not null check(business_number~'^[A-Z]{2,8}[0-9A-F]{16}$'),
  search_hash char(64) not null check(search_hash~'^[0-9a-f]{64}$'),
  source text not null check(source in('native','backfill','external')),
  created_by text not null,
  created_at timestamptz not null,
  version bigint not null check(version>0),
  primary key(aggregate_type,internal_id),
  unique(tenant_id,business_number),
  unique(tenant_id,search_hash)
);
insert into runtime.businessreference(tenant_id,scope_id,aggregate_type,internal_id,business_number,search_hash,source,created_by,created_at,version)
select scope_id,scope_id,'catalog.product',id,'PR'||upper(substr(encode(public.digest(id,'sha256'),'hex'),1,16)),
  encode(public.digest(lower(id),'sha256'),'hex'),'backfill','migration:reference',clock_timestamp(),1 from catalog.product
union all
select scope_id,scope_id,'order.order',id,'OR'||upper(substr(encode(public.digest(id,'sha256'),'hex'),1,16)),
  encode(public.digest(lower(id),'sha256'),'hex'),'backfill','migration:reference',clock_timestamp(),1 from ordering.orderrecord
union all
select orders.scope_id,orders.scope_id,'payment.intent',intent.id,'PI'||upper(substr(encode(public.digest(intent.id,'sha256'),'hex'),1,16)),
  encode(public.digest(lower(intent.id),'sha256'),'hex'),'backfill','migration:reference',clock_timestamp(),1
  from payment.intent intent join ordering.orderrecord orders on orders.id=intent.order_id
union all
select scope_id,scope_id,'voucher.voucher',id,'VO'||upper(substr(encode(public.digest(id,'sha256'),'hex'),1,16)),
  encode(public.digest(lower(id),'sha256'),'hex'),'backfill','migration:reference',clock_timestamp(),1 from voucher.voucher
union all
select scope_id,scope_id,'finance.journal',id,'FI'||upper(substr(encode(public.digest(id,'sha256'),'hex'),1,16)),
  encode(public.digest(lower(id),'sha256'),'hex'),'backfill','migration:reference',clock_timestamp(),1 from finance.journal
union all
select tenant_id,scope_id,'approval.instance',id,'AP'||upper(substr(encode(public.digest(id,'sha256'),'hex'),1,16)),
  encode(public.digest(lower(id),'sha256'),'hex'),'backfill','migration:reference',clock_timestamp(),1 from approval.instances
union all
select tenant_id,scope_id,'partner.customer',id,'CU'||upper(substr(encode(public.digest(id,'sha256'),'hex'),1,16)),
  encode(public.digest(lower(id),'sha256'),'hex'),'backfill','migration:reference',clock_timestamp(),1 from partner.customer;
alter table runtime.businessreference enable row level security;
alter table runtime.businessreference force row level security;
create policy migrationaccess on runtime.businessreference for all to shopmigration using(true) with check(true);
create policy businessreferenceapp on runtime.businessreference for select to shopapp using(access.scope_allowed(scope_id));
create policy businessreferencejob on runtime.businessreference for all to shopjob using(true) with check(true);
revoke all on runtime.businessreference from public;
grant select on runtime.businessreference to shopapp;
grant select,insert on runtime.businessreference to shopjob;

select runtime.record_migration_evidence('20260904059000',
  (select count(*) from catalog.product)+(select count(*) from ordering.orderrecord)+(select count(*) from payment.intent)
    +(select count(*) from voucher.voucher)+(select count(*) from finance.journal)+(select count(*) from approval.instances)
    +(select count(*) from partner.customer),
  (select count(*) from runtime.businessreference),0,0,
  'select aggregate_type,count(*) from runtime.businessreference group by aggregate_type order by aggregate_type;',
  'select aggregate_type,business_number,search_hash from runtime.businessreference order by aggregate_type,business_number;');
insert into runtime.schemaversion(version,checksum)
values('20260904059000',encode(public.digest('20260904059000_backfill_business_references','sha256'),'hex'));

commit;
