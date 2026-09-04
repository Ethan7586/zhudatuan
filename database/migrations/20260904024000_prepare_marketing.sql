begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904023000') then raise exception 'MARKETING_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904024000') then raise exception 'MARKETING_ALREADY_APPLIED'; end if;
end $precondition$;

update marketing.campaign set state='disabled' where state in('paused','cancelled');
update marketing.campaign set budget_minor=greatest(budget_minor,1),version=greatest(version,1);

alter table marketing.campaign add column budget_version bigint not null default 1;
alter table marketing.campaign add column published_at timestamptz;
alter table marketing.campaign add column disabled_at timestamptz;
alter table marketing.campaign add column disable_reason text;
alter table marketing.campaign add column created_by text not null default 'migration:marketing';
alter table marketing.campaign add column updated_by text not null default 'migration:marketing';

update marketing.campaign set
  published_at=case when state in('scheduled','active','completed') then coalesce(published_at,created_at) else null end,
  disabled_at=case when state='disabled' then coalesce(disabled_at,updated_at) else null end,
  disable_reason=case when state='disabled' then coalesce(disable_reason,'历史活动已停用') else null end;

with source as(
  select id,kind,effective_at,expires_at,rule,
    case when jsonb_typeof(rule->'audience')='object' then rule->'audience' else '{}'::jsonb end audience,
    case when jsonb_typeof(rule->'products')='object' then rule->'products' else '{}'::jsonb end products,
    case when jsonb_typeof(rule->'promotion')='object' then rule->'promotion' else rule end promotion,
    case when jsonb_typeof(rule->'coupon')='object' then rule->'coupon' else '{}'::jsonb end coupon
  from marketing.campaign
), normalized as(
  select id,jsonb_build_object(
    'audience',jsonb_build_object(
      'memberTags',case when jsonb_typeof(audience->'memberTags')='array' then audience->'memberTags' else '[]'::jsonb end,
      'qualificationStates',case when jsonb_typeof(audience->'qualificationStates')='array' then audience->'qualificationStates' else '[]'::jsonb end),
    'products',jsonb_build_object(
      'productIds',case when jsonb_typeof(products->'productIds')='array' then products->'productIds' else '[]'::jsonb end,
      'categoryIds',case when jsonb_typeof(products->'categoryIds')='array' then products->'categoryIds' else '[]'::jsonb end,
      'listingIds',case when jsonb_typeof(products->'listingIds')='array' then products->'listingIds' else '[]'::jsonb end),
    'channels',case when jsonb_typeof(rule->'channels')='array' and jsonb_array_length(rule->'channels')>0
      then rule->'channels' else '["web","miniapp","store"]'::jsonb end,
    'promotion',jsonb_build_object(
      'priority',case when jsonb_typeof(promotion->'priority')='number' then greatest((promotion->>'priority')::numeric,0)::bigint else 100 end,
      'fixedMinor',case when jsonb_typeof(promotion->'fixedMinor')='number' then greatest((promotion->>'fixedMinor')::numeric,1)::bigint else 1 end,
      'basisPoints',case when jsonb_typeof(promotion->'basisPoints')='number' then least(greatest((promotion->>'basisPoints')::numeric,0),10000)::bigint else 0 end,
      'minimumSubtotal',case when jsonb_typeof(promotion->'minimumSubtotal')='number' then greatest((promotion->>'minimumSubtotal')::numeric,0)::bigint else 0 end,
      'maximumMinor',case when jsonb_typeof(promotion->'maximumMinor')='number' then greatest((promotion->>'maximumMinor')::numeric,0)::bigint else null end,
      'stackable',case when jsonb_typeof(promotion->'stackable')='boolean' then promotion->'stackable' else 'false'::jsonb end,
      'exclusiveGroup',case when coalesce(promotion->>'exclusiveGroup','')~'^[a-z][a-z0-9]{1,31}$' then promotion->>'exclusiveGroup' else 'default' end),
    'coupon',case when kind<>'coupon' then null else jsonb_build_object(
      'perMemberLimit',case when jsonb_typeof(coupon->'perMemberLimit')='number' then greatest((coupon->>'perMemberLimit')::numeric,1)::bigint else 1 end,
      'totalLimit',case when jsonb_typeof(coupon->'totalLimit')='number' then greatest((coupon->>'totalLimit')::numeric,1)::bigint else 1 end,
      'claimStartsAt',coalesce(coupon->>'claimStartsAt',effective_at::text),
      'claimEndsAt',coalesce(coupon->>'claimEndsAt',expires_at::text,(effective_at+interval '10 years')::text)) end
  ) value from source
)
update marketing.campaign target set rule=normalized.value from normalized where normalized.id=target.id;

alter table marketing.campaign drop constraint campaign_state_check;
alter table marketing.campaign drop constraint campaign_budget_minor_check;
alter table marketing.campaign add constraint marketing_campaign_state check(state in('draft','scheduled','active','disabled','completed')) not valid;
alter table marketing.campaign add constraint marketing_campaign_budget check(budget_minor>0 and spent_minor>=0 and spent_minor<=budget_minor) not valid;
alter table marketing.campaign add constraint marketing_campaign_currency check(currency='CNY') not valid;
alter table marketing.campaign add constraint marketing_campaign_version check(version>0 and budget_version>0) not valid;
alter table marketing.campaign add constraint marketing_campaign_rule check(
  jsonb_typeof(rule)='object' and jsonb_typeof(rule->'audience')='object' and jsonb_typeof(rule#>'{audience,memberTags}')='array'
  and jsonb_typeof(rule#>'{audience,qualificationStates}')='array' and jsonb_typeof(rule->'products')='object'
  and jsonb_typeof(rule#>'{products,productIds}')='array' and jsonb_typeof(rule#>'{products,categoryIds}')='array'
  and jsonb_typeof(rule#>'{products,listingIds}')='array' and jsonb_typeof(rule->'channels')='array'
  and jsonb_array_length(rule->'channels')>0 and jsonb_typeof(rule->'promotion')='object'
  and jsonb_typeof(rule#>'{promotion,priority}')='number' and jsonb_typeof(rule#>'{promotion,fixedMinor}')='number'
  and jsonb_typeof(rule#>'{promotion,basisPoints}')='number' and jsonb_typeof(rule#>'{promotion,minimumSubtotal}')='number'
  and jsonb_typeof(rule#>'{promotion,stackable}')='boolean' and coalesce(rule#>>'{promotion,exclusiveGroup}','')~'^[a-z][a-z0-9]{1,31}$'
  and (kind<>'coupon' or jsonb_typeof(rule->'coupon')='object')
) not valid;
alter table marketing.campaign add constraint marketing_campaign_lifecycle check(
  (state<>'draft' or published_at is null)
  and (state not in('scheduled','active','completed') or published_at is not null)
  and ((state='disabled' and disabled_at is not null and disable_reason is not null)
    or (state<>'disabled' and disabled_at is null and disable_reason is null))
) not valid;
alter table marketing.campaign validate constraint marketing_campaign_state;
alter table marketing.campaign validate constraint marketing_campaign_budget;
alter table marketing.campaign validate constraint marketing_campaign_currency;
alter table marketing.campaign validate constraint marketing_campaign_version;
alter table marketing.campaign validate constraint marketing_campaign_rule;
alter table marketing.campaign validate constraint marketing_campaign_lifecycle;

update marketing.redemption set order_id='order:legacy:'||encode(public.digest(id,'sha256'),'hex') where order_id is null;
update marketing.redemption set state='released' where state not in('reserved','committed','released');
alter table marketing.redemption alter column order_id set not null;
alter table marketing.redemption add column restored_minor bigint not null default 0;
alter table marketing.redemption add column campaign_version bigint not null default 1;
alter table marketing.redemption add column expires_at timestamptz;
alter table marketing.redemption add column version bigint not null default 1;
update marketing.redemption set expires_at=coalesce(expires_at,updated_at+interval '15 minutes');
alter table marketing.redemption alter column expires_at set not null;
alter table marketing.redemption drop constraint redemption_state_check;
alter table marketing.redemption add constraint marketing_redemption_state check(state in('reserved','committed','released','refunded')) not valid;
alter table marketing.redemption add constraint marketing_redemption_amount check(amount_minor>0 and restored_minor between 0 and amount_minor) not valid;
alter table marketing.redemption add constraint marketing_redemption_version check(campaign_version>0 and version>0) not valid;
alter table marketing.redemption add constraint marketing_redemption_period check(expires_at>created_at) not valid;
alter table marketing.redemption add constraint marketing_redemption_campaign_order unique(campaign_id,order_id);
alter table marketing.redemption validate constraint marketing_redemption_state;
alter table marketing.redemption validate constraint marketing_redemption_amount;
alter table marketing.redemption validate constraint marketing_redemption_version;
alter table marketing.redemption validate constraint marketing_redemption_period;

create index marketing_campaign_effective on marketing.campaign(scope_id,state,effective_at,expires_at,id)
include(version,budget_version,budget_minor,spent_minor,currency,kind);
create index marketing_redemption_due on marketing.redemption(expires_at,campaign_id,id)
include(order_id,amount_minor,version) where state='reserved';
create index marketing_redemption_order on marketing.redemption(order_id,campaign_id,id)
include(state,amount_minor,restored_minor,campaign_version,version);

create function marketing.guard_campaign() returns trigger language plpgsql security definer
set search_path=marketing,pg_temp set row_security=off as $function$
declare business_changed boolean;
declare budget_changed boolean;
begin
  if new.version<1 or new.budget_version<1 then raise exception 'MARKETING_CAMPAIGN_VERSION_INVALID'; end if;
  if tg_op='INSERT' then return new; end if;
  if (new.id,new.scope_id,new.created_by,new.created_at) is distinct from (old.id,old.scope_id,old.created_by,old.created_at)
    then raise exception 'MARKETING_CAMPAIGN_IDENTITY_IMMUTABLE'; end if;
  business_changed=(new.kind,new.name,new.state,new.budget_minor,new.currency,new.rule,new.effective_at,new.expires_at,
    new.published_at,new.disabled_at,new.disable_reason,new.updated_by)
    is distinct from (old.kind,old.name,old.state,old.budget_minor,old.currency,old.rule,old.effective_at,old.expires_at,
    old.published_at,old.disabled_at,old.disable_reason,old.updated_by);
  budget_changed=new.spent_minor is distinct from old.spent_minor;
  if business_changed and budget_changed then raise exception 'MARKETING_CAMPAIGN_MUTATION_MIXED'; end if;
  if business_changed and (new.version<>old.version+1 or new.budget_version<>old.budget_version)
    then raise exception 'MARKETING_CAMPAIGN_VERSION_CONFLICT'; end if;
  if budget_changed and (new.version<>old.version or new.budget_version<>old.budget_version+1)
    then raise exception 'MARKETING_BUDGET_VERSION_CONFLICT'; end if;
  if not business_changed and not budget_changed and (new.version,new.budget_version) is distinct from (old.version,old.budget_version)
    then raise exception 'MARKETING_CAMPAIGN_VERSION_CONFLICT'; end if;
  return new;
end
$function$;
create trigger marketingcampaignguard before insert or update on marketing.campaign for each row execute function marketing.guard_campaign();

create function marketing.guard_redemption() returns trigger language plpgsql security definer
set search_path=marketing,pg_temp set row_security=off as $function$
begin
  if new.version<1 or new.campaign_version<1 or new.expires_at<=new.created_at then raise exception 'MARKETING_REDEMPTION_INVALID'; end if;
  if tg_op='INSERT' then
    if new.state<>'reserved' or new.restored_minor<>0 then raise exception 'MARKETING_REDEMPTION_INITIAL_STATE_INVALID'; end if;
    return new;
  end if;
  if (new.id,new.campaign_id,new.member_id,new.order_id,new.amount_minor,new.idempotency_key,new.campaign_version,new.expires_at,new.created_at)
    is distinct from (old.id,old.campaign_id,old.member_id,old.order_id,old.amount_minor,old.idempotency_key,old.campaign_version,old.expires_at,old.created_at)
    then raise exception 'MARKETING_REDEMPTION_IDENTITY_IMMUTABLE'; end if;
  if old.state='reserved' and new.state not in('reserved','committed','released') then raise exception 'MARKETING_REDEMPTION_TRANSITION_INVALID'; end if;
  if old.state='committed' and new.state not in('committed','refunded') then raise exception 'MARKETING_REDEMPTION_TRANSITION_INVALID'; end if;
  if old.state in('released','refunded') and new is distinct from old then raise exception 'MARKETING_REDEMPTION_FINAL'; end if;
  if (new.state,new.restored_minor) is distinct from (old.state,old.restored_minor) and new.version<>old.version+1
    then raise exception 'MARKETING_REDEMPTION_VERSION_CONFLICT'; end if;
  if (new.state,new.restored_minor) is not distinct from (old.state,old.restored_minor) and new.version<>old.version
    then raise exception 'MARKETING_REDEMPTION_VERSION_CONFLICT'; end if;
  return new;
end
$function$;
create trigger marketingredemptionguard before insert or update on marketing.redemption for each row execute function marketing.guard_redemption();
revoke all on function marketing.guard_campaign(),marketing.guard_redemption() from public;

insert into access.permission(id,code,risk,status,name_zh)
values('permission:marketing.manage','marketing.manage','critical','active','管理营销活动');
update access.permission set name_zh='查看营销活动' where code='marketing.read';
update access.roletemplate set allows=array_append(allows,'marketing.manage'),version=version+1,updated_at=clock_timestamp()
where code='malloperator' and not('marketing.manage'=any(allows));
insert into access.rolepermission(role_id,permission_id,effect)
select mapping.role_id,manage.id,'allow' from access.rolepermission mapping
join access.permission readpermission on readpermission.id=mapping.permission_id and readpermission.code='marketing.read'
cross join access.permission manage where manage.code='marketing.manage' and mapping.effect='allow'
on conflict(role_id,permission_id) do update set effect='allow';

update runtime.operation set contract_version='5.0.0' where id='marketing.campaigns.read';
insert into runtime.operation(id,owner,method,path,contract_version) values
  ('marketing.campaigns.create','marketing','POST','/api/v1/marketing/campaigns','5.0.0'),
  ('marketing.campaigns.revise','marketing','PUT','/api/v1/marketing/campaigns/{campaignid}','5.0.0'),
  ('marketing.campaigns.publish','marketing','PUT','/api/v1/marketing/campaigns/{campaignid}/publication','5.0.0'),
  ('marketing.campaigns.disable','marketing','PUT','/api/v1/marketing/campaigns/{campaignid}/disablement','5.0.0');

update capability.capability set version=2 where id='marketing.campaigns.read';
insert into capability.capability(id,kind,name,version,status) values
  ('marketing.campaigns.create','operation','marketing.campaigns.create',1,'active'),
  ('marketing.campaigns.revise','operation','marketing.campaigns.revise',1,'active'),
  ('marketing.campaigns.publish','operation','marketing.campaigns.publish',1,'active'),
  ('marketing.campaigns.disable','operation','marketing.campaigns.disable',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('marketing.campaigns.create','marketing.campaigns.create','marketing.manage','console',array['console']),
  ('marketing.campaigns.revise','marketing.campaigns.revise','marketing.manage','console',array['console']),
  ('marketing.campaigns.publish','marketing.campaigns.publish','marketing.manage','console',array['console']),
  ('marketing.campaigns.disable','marketing.campaigns.disable','marketing.manage','console',array['console']);
insert into capability.dependency(capability_id,depends_on_id) values
  ('marketing.campaigns.create','marketing.campaigns.read'),
  ('marketing.campaigns.revise','marketing.campaigns.read'),
  ('marketing.campaigns.publish','marketing.campaigns.read'),
  ('marketing.campaigns.disable','marketing.campaigns.read');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,1,
  clock_timestamp(),clock_timestamp(),'migration:marketing','启用完整营销活动生命周期'
from capability.capability capability where capability.id in(
  'marketing.campaigns.create','marketing.campaigns.revise','marketing.campaigns.publish','marketing.campaigns.disable');
insert into capability.entitlementhistory(id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select 'entitlementhistory:'||encode(public.digest(entitlement.id||':marketing','sha256'),'hex'),entitlement.id,entitlement.scope_id,
  entitlement.capability_id,entitlement.state,entitlement.quota,entitlement.effective_at,entitlement.expires_at,entitlement.version,
  'migration:marketing','启用完整营销活动生命周期',clock_timestamp()
from capability.entitlement entitlement where entitlement.capability_id in(
  'marketing.campaigns.create','marketing.campaigns.revise','marketing.campaigns.publish','marketing.campaigns.disable');
update capability.capabilityset set version=version+1,updated_at=clock_timestamp() where scope_id='organization-platform-root';

insert into runtime.event(type,version,owner,schema_ref) values
  ('marketing.campaign.created',1,'marketing','contract://events/marketing.campaign.created/v1'),
  ('marketing.campaign.revised',1,'marketing','contract://events/marketing.campaign.revised/v1'),
  ('marketing.campaign.published',1,'marketing','contract://events/marketing.campaign.published/v1'),
  ('marketing.campaign.disabled',1,'marketing','contract://events/marketing.campaign.disabled/v1'),
  ('marketing.promotion.reserved',1,'marketing','contract://events/marketing.promotion.reserved/v1'),
  ('marketing.promotion.committed',1,'marketing','contract://events/marketing.promotion.committed/v1'),
  ('marketing.promotion.released',1,'marketing','contract://events/marketing.promotion.released/v1'),
  ('marketing.promotion.refunded',1,'marketing','contract://events/marketing.promotion.refunded/v1');

update runtime.contractcatalog set checksum='312260ead9f0c459ed2c38623d8310de8b3ef3260c313d098302fb50015e7df0',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904024000',(select count(*) from marketing.campaign),(select count(*) from marketing.campaign),0,0,
  'create index concurrently if not exists marketing_campaign_effective_live on marketing.campaign(scope_id,state,effective_at,expires_at,id) include(version,budget_version,budget_minor,spent_minor) where state in(''scheduled'',''active'');',
  'select state,count(*) from marketing.redemption group by state;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904024000','312260ead9f0c459ed2c38623d8310de8b3ef3260c313d098302fb50015e7df0');

do $assert$ begin
  if exists(select 1 from marketing.campaign where version<1 or budget_version<1 or budget_minor<=0 or spent_minor>budget_minor
    or currency<>'CNY' or jsonb_typeof(rule#>'{promotion}')<>'object') then raise exception 'MARKETING_CAMPAIGN_INVARIANT_INVALID'; end if;
  if exists(select 1 from marketing.redemption where version<1 or campaign_version<1 or restored_minor<0
    or restored_minor>amount_minor or expires_at<=created_at) then raise exception 'MARKETING_REDEMPTION_INVARIANT_INVALID'; end if;
  if (select count(*) from runtime.operation)<>312 then raise exception 'MARKETING_OPERATION_COUNT_INVALID'; end if;
  if (select count(*) from runtime.event)<>143 then raise exception 'MARKETING_EVENT_COUNT_INVALID'; end if;
end $assert$;

commit;
