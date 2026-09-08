begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260907013000') then
    raise exception 'CHECKOUT_EVIDENCE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260908010000') then
    raise exception 'CHECKOUT_EVIDENCE_ALREADY_APPLIED';
  end if;
  if exists(
    select 1
    from checkout.evidence legacy
    join checkout.evidence canonical
      on canonical.checkout_id=legacy.checkout_id
      and canonical.reference_id=legacy.reference_id
      and canonical.kind='shipping'
    where legacy.kind='delivery'
  ) then
    raise exception 'CHECKOUT_EVIDENCE_SHIPPING_COLLISION';
  end if;
end
$precondition$;

alter table checkout.evidence drop constraint evidence_kind_check;
update checkout.evidence set kind='shipping' where kind='delivery';
alter table checkout.evidence add constraint evidence_kind_check check(kind in(
  'cart','profile','address','invoice','experience','catalog','qualification','pricing','inventory',
  'marketing','vouchers','benefits','shipping','tax','risk'
));

select runtime.record_migration_evidence('20260908010000',
  (select count(*) from checkout.evidence),(select count(*) from checkout.evidence),0,0,
  'select kind,count(*) from checkout.evidence group by kind order by kind;',
  'select checkout_id,kind,reference_id,version,payload_hash from checkout.evidence order by checkout_id,kind,reference_id limit 100;');

insert into runtime.schemaversion(version,checksum)
values('20260908010000',encode(public.digest('20260908010000_align_checkout_evidence','sha256'),'hex'));
update runtime.schemahead set migration_head='20260908010000',migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:checkout',published_at=clock_timestamp() where artifact='commerce';

do $assert$
begin
  if exists(select 1 from checkout.evidence where kind not in(
    'cart','profile','address','invoice','experience','catalog','qualification','pricing','inventory',
    'marketing','vouchers','benefits','shipping','tax','risk'
  )) then
    raise exception 'CHECKOUT_EVIDENCE_KIND_INVALID';
  end if;
  if exists(select 1 from checkout.evidence where kind='delivery') then
    raise exception 'CHECKOUT_EVIDENCE_LEGACY_KIND_RETAINED';
  end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce' and migration_head='20260908010000'
    and migration_count=(select count(*) from runtime.schemaversion)) then
    raise exception 'CHECKOUT_EVIDENCE_HEAD_INVALID';
  end if;
end
$assert$;

commit;
