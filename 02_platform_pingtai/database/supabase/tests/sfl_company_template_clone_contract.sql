create temp table company_clone_source_before as
select
  (select to_jsonb(realm) from identity.realm realm where realm.id='realm:l0') realm,
  (select to_jsonb(node) from organization.node node where node.id='node:zhudatuan:l0') node,
  (select to_jsonb(mall) from organization.organization mall where mall.id='mall-zhudatuan') mall,
  (select count(*) from ordering.orderrecord where mall_id='mall-zhudatuan') orders,
  (select count(*) from payment.capture where mall_id='mall-zhudatuan') captures,
  (select count(*) from payment.refund) refunds,
  (select count(*) from finance.entry) finance_entries,
  (select count(*) from inventory.movement) inventory_movements,
  (select count(*) from identity.session where realm_id='realm:l0') sessions,
  (select count(*) from identity.credential where realm_id='realm:l0') credentials;

create temp table company_clone_results as
select * from organization.clone_company_template(jsonb_build_object(
  'idempotency_key','company-clone:success-a','source_realm_id','realm:l0',
  'source_membership_id','membership:company-clone-source','company_name','克隆目标公司甲',
  'mall_name','克隆目标商城甲','requested_by','principal:company-clone-source','trace_id','trace:company-clone:a'
));

insert into company_clone_results
select * from organization.clone_company_template(jsonb_build_object(
  'idempotency_key','company-clone:success-a','source_realm_id','realm:l0',
  'source_membership_id','membership:company-clone-source','company_name','克隆目标公司甲',
  'mall_name','克隆目标商城甲','requested_by','principal:company-clone-source','trace_id','trace:company-clone:a-replay'
));

insert into company_clone_results
select * from organization.clone_company_template(jsonb_build_object(
  'idempotency_key','company-clone:success-b','source_realm_id','realm:l0',
  'source_membership_id','membership:company-clone-source','company_name','克隆目标公司乙',
  'mall_name','克隆目标商城乙','requested_by','principal:company-clone-source','trace_id','trace:company-clone:b'
));

do $success$
declare
  first_result record;
  second_result record;
begin
  select * into first_result from company_clone_results where business_number=(
    select business_number from company_clone_results group by business_number having count(*)=2
  ) and replayed=false;
  select * into second_result from company_clone_results where business_number<>first_result.business_number;

  if (select count(*) from company_clone_results)<>3
    or (select count(distinct clone_id) from company_clone_results)<>2
    or (select count(*) from company_clone_results where replayed)<>1
    or first_result.source_realm_id=first_result.target_realm_id
    or first_result.source_mall_id=first_result.target_mall_id
    or first_result.source_line_id=first_result.target_line_id
    or first_result.source_node_id=first_result.target_node_id
    or first_result.target_membership_id='membership:company-clone-source'
    or first_result.target_realm_id=second_result.target_realm_id
    or first_result.target_mall_id=second_result.target_mall_id
    or first_result.target_line_id=second_result.target_line_id
    or first_result.target_node_id=second_result.target_node_id
    or first_result.target_membership_id=second_result.target_membership_id then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_IDENTITY_INVALID';
  end if;

  if not exists(select 1 from identity.realm realm
      join organization.node node on node.realm_id=realm.id and node.id=first_result.target_node_id
      join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
        and relation.superseded_at is null
      join organization.nodeclosure closure on closure.line_id=node.line_id
        and closure.descendant_node_id=node.id and closure.ancestor_node_id=node.id
        and closure.depth=0 and closure.superseded_at is null
      where realm.id=first_result.target_realm_id and realm.mall_id=first_result.target_mall_id
        and realm.node_profile='operating_mall' and realm.host_node_id=first_result.host_sovereign_node_id
        and node.sovereignty_tier='hosted' and node.node_profile='operating_mall'
        and relation.signed_level='L0' and relation.parent_node_id is null
        and relation.host_sovereign_node_id=first_result.host_sovereign_node_id)
    or not exists(select 1 from organization.operatingline line
      where line.id=first_result.target_line_id and line.template_line_id=first_result.source_line_id
        and line.root_node_id=first_result.target_node_id)
    or not exists(select 1 from organization.organization entity
      join organization.organization mall on mall.parent_id=entity.id
      join organization.malloperatingentitybinding binding on binding.operating_entity_id=entity.id
        and binding.mall_id=mall.id and binding.membership_id=first_result.target_membership_id
      where entity.id=first_result.target_operating_entity_id and entity.kind='enterprise'
        and mall.id=first_result.target_mall_id and mall.kind='mall')
    or not exists(select 1 from access.membership membership
      join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
      where membership.id=first_result.target_membership_id and membership.realm_id=first_result.target_realm_id
        and membership.organization_id=first_result.target_mall_id and membership.client='operator'
        and account.legacy_principal_id='principal:company-clone-source') then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_STRUCTURE_INCOMPLETE';
  end if;

  if (select target.capabilities from organization.nodecapabilityversion target
      where target.node_id=first_result.target_node_id and target.capability_version=1)
      is distinct from
      (select source.capabilities from organization.nodecapabilityversion source
        where source.node_id=first_result.source_node_id order by source.capability_version desc limit 1)
    or not exists(select 1 from catalog.pool pool
      join catalog.poolbinding binding on binding.pool_id=pool.id and binding.mall_id=first_result.target_mall_id
      where pool.id=first_result.target_pool_id and pool.scope_id=first_result.target_mall_id)
    or not exists(select 1 from experience.application application
      join experience.version version on version.id=application.head_version_id
      join experience.binding binding on binding.application_id=application.id
        and binding.mall_id=first_result.target_mall_id and binding.pool_id=first_result.target_pool_id
      where application.id=first_result.target_application_id and application.scope_id=first_result.target_mall_id
        and application.status='draft' and version.configuration->>'application'=first_result.target_application_id)
    or (select count(*) from organization.companyuniquebinding binding
      where binding.clone_id=first_result.clone_id and binding.status='pending'
        and binding.binding_ref is null)<>4
    or exists(select 1 from organization.companyuniquebinding binding
      where binding.clone_id=first_result.clone_id and binding.binding_kind not in
        ('domain','legal_identity','payment_merchant','payment_secret')) then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_CONFIGURATION_INVALID';
  end if;

  if exists(select 1 from identity.realmentry where realm_id=first_result.target_realm_id)
    or exists(select 1 from identity.realmtarget where realm_id=first_result.target_realm_id)
    or exists(select 1 from identity.credential where realm_id=first_result.target_realm_id)
    or exists(select 1 from identity.session where realm_id=first_result.target_realm_id)
    or exists(select 1 from checkout.session where mall_id=first_result.target_mall_id)
    or exists(select 1 from ordering.orderrecord where mall_id=first_result.target_mall_id)
    or exists(select 1 from payment.capture where mall_id=first_result.target_mall_id)
    or exists(select 1 from finance.account where scope_id=first_result.target_mall_id)
    or exists(select 1 from inventory.stockitem where scope_id=first_result.target_mall_id)
    or exists(select 1 from catalog.poolitem where pool_id=first_result.target_pool_id)
    or exists(select 1 from catalog.listing where scope_id=first_result.target_mall_id) then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_BUSINESS_FACT_LEAK';
  end if;

  if (select count(*) from organization.companyclone)<>2
    or (select count(*) from runtime.outbox where event_type='runtime.operation.completed'
      and payload->>'operation_id'='internal.company-template.clone')<>2
    or exists(select 1 from organization.companyclone where status<>'pending_bindings'
      or infrastructure_action_count<>0)
    or exists(select 1 from organization.hostedmallconfiguration configuration
      join organization.companyclone cloned on cloned.target_node_id=configuration.node_id
      where configuration.infrastructure_mode<>'shared_host' or configuration.entry_mode<>'hosted_path'
        or configuration.payment_mode<>'pending_independent_binding'
        or configuration.shared_payment_binding_ref is not null) then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_HOSTED_STATE_INVALID';
  end if;
end
$success$;

do $failure_after_identity$
declare before_counts record; after_counts record;
begin
  select (select count(*) from identity.realm) realms,(select count(*) from organization.node) nodes,
    (select count(*) from organization.organization) organizations,(select count(*) from organization.companyclone) clones,
    (select count(*) from runtime.outbox) outbox into before_counts;
  perform set_config('sfl.company_template_clone_interrupt','after-identity',true);
  begin
    perform organization.clone_company_template(jsonb_build_object(
      'idempotency_key','company-clone:failure-identity','source_realm_id','realm:l0',
      'source_membership_id','membership:company-clone-source','company_name','失败公司一',
      'mall_name','失败商城一','requested_by','principal:company-clone-source','trace_id','trace:failure:identity'));
    raise exception 'EXPECTED_INTERRUPTION';
  exception when others then
    if sqlerrm not like '%SFL_COMPANY_TEMPLATE_CLONE_TEST_INTERRUPT%' then raise; end if;
  end;
  perform set_config('sfl.company_template_clone_interrupt','',true);
  select (select count(*) from identity.realm) realms,(select count(*) from organization.node) nodes,
    (select count(*) from organization.organization) organizations,(select count(*) from organization.companyclone) clones,
    (select count(*) from runtime.outbox) outbox into after_counts;
  if before_counts is distinct from after_counts then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_IDENTITY_INTERRUPTION_NOT_ATOMIC';
  end if;
end
$failure_after_identity$;

do $failure_after_configuration$
declare before_counts record; after_counts record;
begin
  select (select count(*) from identity.realm) realms,(select count(*) from organization.node) nodes,
    (select count(*) from access.membership) memberships,(select count(*) from catalog.pool) pools,
    (select count(*) from experience.application) applications,
    (select count(*) from organization.hostedmallconfiguration) configurations,
    (select count(*) from organization.companyclone) clones into before_counts;
  perform set_config('sfl.company_template_clone_interrupt','after-configuration',true);
  begin
    perform organization.clone_company_template(jsonb_build_object(
      'idempotency_key','company-clone:failure-configuration','source_realm_id','realm:l0',
      'source_membership_id','membership:company-clone-source','company_name','失败公司二',
      'mall_name','失败商城二','requested_by','principal:company-clone-source','trace_id','trace:failure:configuration'));
    raise exception 'EXPECTED_INTERRUPTION';
  exception when others then
    if sqlerrm not like '%SFL_COMPANY_TEMPLATE_CLONE_TEST_INTERRUPT%' then raise; end if;
  end;
  perform set_config('sfl.company_template_clone_interrupt','',true);
  select (select count(*) from identity.realm) realms,(select count(*) from organization.node) nodes,
    (select count(*) from access.membership) memberships,(select count(*) from catalog.pool) pools,
    (select count(*) from experience.application) applications,
    (select count(*) from organization.hostedmallconfiguration) configurations,
    (select count(*) from organization.companyclone) clones into after_counts;
  if before_counts is distinct from after_counts then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_CONFIGURATION_INTERRUPTION_NOT_ATOMIC';
  end if;
end
$failure_after_configuration$;

do $source_immutable$
declare before_row company_clone_source_before%rowtype;
begin
  select * into before_row from company_clone_source_before;
  if before_row.realm is distinct from (select to_jsonb(realm) from identity.realm realm where realm.id='realm:l0')
    or before_row.node is distinct from (select to_jsonb(node) from organization.node node where node.id='node:zhudatuan:l0')
    or before_row.mall is distinct from (select to_jsonb(mall) from organization.organization mall where mall.id='mall-zhudatuan')
    or before_row.orders<>(select count(*) from ordering.orderrecord where mall_id='mall-zhudatuan')
    or before_row.captures<>(select count(*) from payment.capture where mall_id='mall-zhudatuan')
    or before_row.refunds<>(select count(*) from payment.refund)
    or before_row.finance_entries<>(select count(*) from finance.entry)
    or before_row.inventory_movements<>(select count(*) from inventory.movement)
    or before_row.sessions<>(select count(*) from identity.session where realm_id='realm:l0')
    or before_row.credentials<>(select count(*) from identity.credential where realm_id='realm:l0') then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_SOURCE_MUTATED';
  end if;
end
$source_immutable$;

select 'SFL_COMPANY_TEMPLATE_CLONE_CONTRACT_OK' result,
  (select count(*) from organization.companyclone) clones,
  (select count(*) from organization.companyuniquebinding) pending_bindings,
  (select count(*) from runtime.outbox where event_type='runtime.operation.completed'
    and payload->>'operation_id'='internal.company-template.clone') outbox_events,
  (select sum(infrastructure_action_count) from organization.companyclone) infrastructure_actions;
