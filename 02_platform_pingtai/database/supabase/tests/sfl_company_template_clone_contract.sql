create temp table company_clone_source_before as
select
  (select to_jsonb(realm) from identity.realm realm where realm.id='realm:l0') realm,
  (select to_jsonb(node) from organization.node node where node.id='node:zhudatuan:l0') node,
  (select to_jsonb(relation) from organization.noderelation relation
    where relation.node_id='node:zhudatuan:l0' and relation.superseded_at is null) relation,
  (select to_jsonb(mall) from organization.organization mall where mall.id='mall-zhudatuan') mall,
  (select to_jsonb(account) from identity.account account where account.id='account:company-clone-source') account,
  (select to_jsonb(membership) from access.membership membership
    where membership.id='membership:company-clone-source') membership,
  (select jsonb_agg(to_jsonb(assignment) order by assignment.role_id) from access.membershiprole assignment
    where assignment.membership_id='membership:company-clone-source') membership_roles,
  (select jsonb_agg(to_jsonb(scopegrant) order by scopegrant.id) from access.scopegrant scopegrant
    where scopegrant.membership_id='membership:company-clone-source') scope_grants,
  (select jsonb_agg(to_jsonb(entitlement) order by entitlement.id) from capability.entitlement entitlement
    where entitlement.scope_id='mall-zhudatuan') entitlements,
  (select count(*) from ordering.orderrecord where mall_id='mall-zhudatuan') orders,
  (select count(*) from payment.capture where mall_id='mall-zhudatuan') captures,
  (select count(*) from payment.refund where mall_id='mall-zhudatuan') refunds,
  (select count(*) from finance.entry entry join finance.account account on account.id=entry.account_id
    where account.scope_id='mall-zhudatuan') finance_entries,
  (select count(*) from fulfillment.fulfillmentorder where mall_id='mall-zhudatuan') fulfillments,
  (select count(*) from inventory.movement where mall_id='mall-zhudatuan') inventory_movements,
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
  source_context record;
  target_context record;
begin
  select * into first_result from company_clone_results where business_number=(
    select business_number from company_clone_results group by business_number having count(*)=2
  ) and replayed=false;
  select * into second_result from company_clone_results where business_number<>first_result.business_number;
  select * into source_context from identity.resolve_active_membership_context(
    'realm:l0','account:company-clone-source','membership:company-clone-source');
  select * into target_context from identity.resolve_active_membership_context(
    first_result.target_realm_id,
    (select account_id from access.membership where id=first_result.target_membership_id),
    first_result.target_membership_id);

  if (select count(*) from company_clone_results)<>3
    or (select count(distinct clone_id) from company_clone_results)<>2
    or (select count(*) from company_clone_results where replayed)<>1
    or first_result.source_realm_id=first_result.target_realm_id
    or first_result.source_mall_id=first_result.target_mall_id
    or first_result.source_line_id=first_result.target_line_id
    or first_result.source_node_id=first_result.target_node_id
        or first_result.target_membership_id='membership:company-clone-source'
    or first_result.target_operating_entity_id='enterprise:company-clone-source'
    or first_result.target_application_id='application:company-clone-source'
    or first_result.target_pool_id='pool:company-clone-source'
    or first_result.target_realm_id=second_result.target_realm_id
    or first_result.target_mall_id=second_result.target_mall_id
    or first_result.target_line_id=second_result.target_line_id
    or first_result.target_node_id=second_result.target_node_id
    or first_result.target_membership_id=second_result.target_membership_id
    or first_result.target_operating_entity_id=second_result.target_operating_entity_id
    or first_result.target_application_id=second_result.target_application_id
    or first_result.target_pool_id=second_result.target_pool_id then
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

  if source_context.active_membership_id<>'membership:company-clone-source'
    or source_context.current_realm_id<>'realm:l0' or source_context.line_id<>first_result.source_line_id
    or source_context.node_id<>first_result.source_node_id
    or target_context.active_membership_id<>first_result.target_membership_id
    or target_context.current_realm_id<>first_result.target_realm_id
    or target_context.line_id<>first_result.target_line_id or target_context.node_id<>first_result.target_node_id
    or target_context.signed_level<>'L0' or target_context.parent_node_id is not null
    or source_context.line_id=target_context.line_id
    or exists(select 1 from identity.resolve_active_membership_context(
      'realm:l0',(select account_id from access.membership where id=first_result.target_membership_id),
      first_result.target_membership_id))
    or exists(select 1 from identity.resolve_active_membership_context(
      first_result.target_realm_id,'account:company-clone-source','membership:company-clone-source'))
    or (select count(*) from identity.account where legacy_principal_id='principal:company-clone-source')<>3
    or (select count(distinct realm_id) from identity.account
      where legacy_principal_id='principal:company-clone-source')<>3
    or exists(select 1 from access.membership target
      where target.id=first_result.target_membership_id and (target.member_id<>'member:company-clone-source'
        or target.status<>'active' or target.access_version<>1))
    or (select count(*) from access.membershiprole where membership_id=first_result.target_membership_id
      and role_id='role:self' and expires_at is null)<>1
    or (select count(*) from access.scopegrant where membership_id=first_result.target_membership_id
      and effect='allow' and expires_at is null)<>3
    or exists(select 1 from access.scopegrant where membership_id=first_result.target_membership_id
      and scope_id='mall-zhudatuan')
    or exists(select 1 from access.scopegrant where membership_id='membership:company-clone-source'
      and scope_id=first_result.target_mall_id)
    or exists(select 1 from capability.entitlement where scope_id=first_result.target_mall_id) then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_ACTIVE_MEMBERSHIP_CROSSED';
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
        and application.status='draft' and version.configuration->>'application'=first_result.target_application_id
        and version.configuration->>'mallName'='克隆目标商城甲'
        and version.configuration->>'theme'='source-template')
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
    or exists(select 1 from payment.refund where mall_id=first_result.target_mall_id)
    or exists(select 1 from finance.account where scope_id=first_result.target_mall_id)
    or exists(select 1 from finance.entry entry join finance.account account on account.id=entry.account_id
      where account.scope_id=first_result.target_mall_id)
    or exists(select 1 from fulfillment.fulfillmentorder where mall_id=first_result.target_mall_id)
    or exists(select 1 from inventory.stockitem where scope_id=first_result.target_mall_id)
    or exists(select 1 from inventory.movement where mall_id=first_result.target_mall_id)
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
    (select count(*) from organization.operatingline) lines,
    (select count(*) from organization.noderelation) relations,
    (select count(*) from organization.nodeclosure) closures,
    (select count(*) from organization.nodecapabilityversion) capability_versions,
    (select count(*) from organization.unitclosure) unitclosures,
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
    (select count(*) from organization.operatingline) lines,
    (select count(*) from organization.noderelation) relations,
    (select count(*) from organization.nodeclosure) closures,
    (select count(*) from organization.nodecapabilityversion) capability_versions,
    (select count(*) from organization.unitclosure) unitclosures,
    (select count(*) from runtime.outbox) outbox into after_counts;
  if before_counts is distinct from after_counts then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_IDENTITY_INTERRUPTION_NOT_ATOMIC';
  end if;
  perform organization.clone_company_template(jsonb_build_object(
    'idempotency_key','company-clone:failure-identity','source_realm_id','realm:l0',
    'source_membership_id','membership:company-clone-source','company_name','失败公司一',
    'mall_name','失败商城一','requested_by','principal:company-clone-source','trace_id','trace:recovery:identity'));
  if (select count(*) from organization.companyclone where idempotency_key='company-clone:failure-identity')<>1
    or not exists(select 1 from organization.companyclone cloned
      join identity.realm realm on realm.id=cloned.target_realm_id
      join organization.node node on node.id=cloned.target_node_id
      join access.membership membership on membership.id=cloned.target_membership_id
      join catalog.pool pool on pool.id=cloned.target_pool_id
      join experience.application application on application.id=cloned.target_application_id
      where cloned.idempotency_key='company-clone:failure-identity') then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_IDENTITY_INTERRUPTION_RECOVERY_FAILED';
  end if;
end
$failure_after_identity$;

do $failure_after_configuration$
declare before_counts record; after_counts record;
begin
  select (select count(*) from identity.realm) realms,(select count(*) from organization.node) nodes,
    (select count(*) from access.membership) memberships,(select count(*) from catalog.pool) pools,
    (select count(*) from identity.account) accounts,(select count(*) from access.membershiprole) roles,
    (select count(*) from access.scopegrant) scope_grants,(select count(*) from access.mallowner) owners,
    (select count(*) from catalog.poolbinding) pool_bindings,
    (select count(*) from experience.application) applications,
    (select count(*) from experience.version) versions,(select count(*) from experience.binding) app_bindings,
    (select count(*) from organization.hostedmallopening) openings,
    (select count(*) from organization.malloperatingentitybinding) entity_bindings,
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
    (select count(*) from identity.account) accounts,(select count(*) from access.membershiprole) roles,
    (select count(*) from access.scopegrant) scope_grants,(select count(*) from access.mallowner) owners,
    (select count(*) from catalog.poolbinding) pool_bindings,
    (select count(*) from experience.application) applications,
    (select count(*) from experience.version) versions,(select count(*) from experience.binding) app_bindings,
    (select count(*) from organization.hostedmallopening) openings,
    (select count(*) from organization.malloperatingentitybinding) entity_bindings,
    (select count(*) from organization.hostedmallconfiguration) configurations,
    (select count(*) from organization.companyclone) clones into after_counts;
  if before_counts is distinct from after_counts then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_CONFIGURATION_INTERRUPTION_NOT_ATOMIC';
  end if;
  perform organization.clone_company_template(jsonb_build_object(
    'idempotency_key','company-clone:failure-configuration','source_realm_id','realm:l0',
    'source_membership_id','membership:company-clone-source','company_name','失败公司二',
    'mall_name','失败商城二','requested_by','principal:company-clone-source','trace_id','trace:recovery:configuration'));
  if (select count(*) from organization.companyclone where idempotency_key='company-clone:failure-configuration')<>1
    or not exists(select 1 from organization.companyclone cloned
      join organization.hostedmallconfiguration configuration on configuration.node_id=cloned.target_node_id
      join catalog.pool pool on pool.id=cloned.target_pool_id
      join experience.application application on application.id=cloned.target_application_id
      where cloned.idempotency_key='company-clone:failure-configuration'
        and configuration.infrastructure_mode='shared_host' and configuration.entry_mode='hosted_path'
        and configuration.payment_mode='pending_independent_binding') then
    raise exception 'SFL_COMPANY_TEMPLATE_CLONE_CONFIGURATION_INTERRUPTION_RECOVERY_FAILED';
  end if;
end
$failure_after_configuration$;

do $source_immutable$
declare before_row company_clone_source_before%rowtype;
begin
  select * into before_row from company_clone_source_before;
  if before_row.realm is distinct from (select to_jsonb(realm) from identity.realm realm where realm.id='realm:l0')
    or before_row.node is distinct from (select to_jsonb(node) from organization.node node where node.id='node:zhudatuan:l0')
    or before_row.relation is distinct from (select to_jsonb(relation) from organization.noderelation relation
      where relation.node_id='node:zhudatuan:l0' and relation.superseded_at is null)
    or before_row.mall is distinct from (select to_jsonb(mall) from organization.organization mall where mall.id='mall-zhudatuan')
    or before_row.account is distinct from (select to_jsonb(account) from identity.account account
      where account.id='account:company-clone-source')
    or before_row.membership is distinct from (select to_jsonb(membership) from access.membership membership
      where membership.id='membership:company-clone-source')
    or before_row.membership_roles is distinct from (select jsonb_agg(to_jsonb(assignment) order by assignment.role_id)
      from access.membershiprole assignment where assignment.membership_id='membership:company-clone-source')
    or before_row.scope_grants is distinct from (select jsonb_agg(to_jsonb(scopegrant) order by scopegrant.id)
      from access.scopegrant scopegrant where scopegrant.membership_id='membership:company-clone-source')
    or before_row.entitlements is distinct from (select jsonb_agg(to_jsonb(entitlement) order by entitlement.id)
      from capability.entitlement entitlement where entitlement.scope_id='mall-zhudatuan')
    or before_row.orders<>(select count(*) from ordering.orderrecord where mall_id='mall-zhudatuan')
    or before_row.captures<>(select count(*) from payment.capture where mall_id='mall-zhudatuan')
    or before_row.refunds<>(select count(*) from payment.refund where mall_id='mall-zhudatuan')
    or before_row.finance_entries<>(select count(*) from finance.entry entry join finance.account account
      on account.id=entry.account_id where account.scope_id='mall-zhudatuan')
    or before_row.fulfillments<>(select count(*) from fulfillment.fulfillmentorder where mall_id='mall-zhudatuan')
    or before_row.inventory_movements<>(select count(*) from inventory.movement where mall_id='mall-zhudatuan')
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
