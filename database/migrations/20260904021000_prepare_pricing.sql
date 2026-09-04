begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904020000') then raise exception 'PRICING_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904021000') then raise exception 'PRICING_ALREADY_APPLIED'; end if;
end $precondition$;

update pricing.pricebook set version=1 where version=0;
alter table pricing.pricebook add constraint pricing_pricebook_version_positive check(version>0) not valid;
alter table pricing.pricebook add constraint pricing_pricebook_currency check(currency='CNY') not valid;
alter table pricing.pricebook validate constraint pricing_pricebook_version_positive;
alter table pricing.pricebook validate constraint pricing_pricebook_currency;

alter table pricing.price add column version bigint not null default 1;
alter table pricing.price add column updated_at timestamptz not null default clock_timestamp();
alter table pricing.price add constraint pricing_offer_version_positive check(version>0);
alter table pricing.price add constraint pricing_offer_period check(expires_at is null or expires_at>effective_at);

create function pricing.version_offer() returns trigger language plpgsql
set search_path=pricing,pg_temp as $function$
begin
  if tg_op='INSERT' then
    new.version=greatest(coalesce(new.version,1),1);
    new.updated_at=coalesce(new.updated_at,clock_timestamp());
  elsif (new.book_id,new.sku_id,new.amount_minor,new.compare_minor,new.effective_at,new.expires_at)
    is distinct from (old.book_id,old.sku_id,old.amount_minor,old.compare_minor,old.effective_at,old.expires_at) then
    new.version=old.version+1;
    new.updated_at=clock_timestamp();
  else
    new.version=old.version;
    new.updated_at=old.updated_at;
  end if;
  return new;
end
$function$;
create trigger pricingofferversion before insert or update on pricing.price for each row execute function pricing.version_offer();

alter table pricing.rule add column expires_at timestamptz;
alter table pricing.rule add column approved_by text;
update pricing.rule set effective_at=coalesce(effective_at,clock_timestamp()),approved_by=case when status='published' then 'migration:pricing' else approved_by end;
alter table pricing.rule alter column effective_at set not null;
alter table pricing.rule add constraint pricing_rule_priority check(priority between 0 and 1000000) not valid;
alter table pricing.rule add constraint pricing_rule_kind check(kind in('markup','discount','tax','freight')) not valid;
alter table pricing.rule add constraint pricing_rule_period check(expires_at is null or expires_at>effective_at) not valid;
alter table pricing.rule add constraint pricing_rule_approval check(status<>'published' or approved_by is not null) not valid;
alter table pricing.rule validate constraint pricing_rule_priority;
alter table pricing.rule validate constraint pricing_rule_kind;
alter table pricing.rule validate constraint pricing_rule_period;
alter table pricing.rule validate constraint pricing_rule_approval;
create index pricing_rule_effective on pricing.rule(scope_id,status,effective_at,expires_at,priority,id) include(version,kind,approved_by);

alter table pricing.quote add column version bigint not null default 1;
alter table pricing.quote add constraint pricing_quote_version_positive check(version>0);
alter table pricing.quote add constraint pricing_quote_period check(expires_at>created_at);
create function pricing.protect_quote() returns trigger language plpgsql
set search_path=pricing,pg_temp as $function$
begin
  raise exception 'PRICING_QUOTE_IMMUTABLE';
end
$function$;
create trigger pricingquoteimmutable before update on pricing.quote for each row execute function pricing.protect_quote();

revoke all on function pricing.version_offer(),pricing.protect_quote() from public;

update capability.capability set version=2 where id in('pricing.rules.create','pricing.rules.publish','pricing.offers.read');
insert into runtime.event(type,version,owner,schema_ref) values
  ('pricing.rule.created',1,'pricing','contract://events/pricing.rule.created/v1'),
  ('pricing.rule.published',1,'pricing','contract://events/pricing.rule.published/v1'),
  ('pricing.offer.changed',1,'pricing','contract://events/pricing.offer.changed/v1');

update runtime.contractcatalog set checksum='6598ebad2c254a212830f0093939dfafe5fd77f0040786965efee849b426da1d',operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904021000',(select count(*) from pricing.price),(select count(*) from pricing.price),0,0,
  'create index concurrently if not exists pricing_offer_effective on pricing.price(book_id,sku_id,effective_at desc,version desc) include(amount_minor,compare_minor,expires_at,updated_at);',
  'select scope_id,status,count(*) from pricing.rule group by scope_id,status;'
);
insert into runtime.schemaversion(version,checksum) values('20260904021000','6598ebad2c254a212830f0093939dfafe5fd77f0040786965efee849b426da1d');

do $assert$ begin
  if exists(select 1 from pricing.pricebook where version<1 or currency<>'CNY') then raise exception 'PRICING_BOOK_INVARIANT_INVALID'; end if;
  if exists(select 1 from pricing.price where version<1 or (expires_at is not null and expires_at<=effective_at)) then raise exception 'PRICING_OFFER_INVARIANT_INVALID'; end if;
  if exists(select 1 from pricing.rule where effective_at is null or (expires_at is not null and expires_at<=effective_at)
    or (status='published' and approved_by is null)) then raise exception 'PRICING_RULE_INVARIANT_INVALID'; end if;
  if exists(select 1 from pricing.quote where version<1 or expires_at<=created_at) then raise exception 'PRICING_QUOTE_INVARIANT_INVALID'; end if;
  if (select count(*) from runtime.event)<>130 then raise exception 'PRICING_EVENT_COUNT_INVALID'; end if;
end $assert$;

commit;
