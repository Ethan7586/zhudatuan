begin;

do $$
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  session_id uuid:=gen_random_uuid();
  authz_version integer;
  credential_version integer;
  read_evidence jsonb;
  decorate_evidence jsonb;
  current_config jsonb:=public.api_default_mall_application_config('Schema V2 契约商城');
  previous_config jsonb;
  migrated jsonb;
  center jsonb;
  error_message text;
begin
  if to_regclass('public.storefront_pages') is not null
     or to_regclass('public.storefront_page_versions') is not null
  then raise exception 'CONTRACT_SECOND_STOREFRONT_SYSTEM_EXISTS'; end if;
  if current_config->>'schemaVersion'<>'2'
     or not public.api_mall_application_config_v2_is_valid(current_config)
     or public.api_mall_application_component_registry()#>>'{limits,blocksPerPage}'<>'30'
     or not public.api_mall_application_component_registry()->'actionTypes' ? 'exchangeable_product'
  then raise exception 'CONTRACT_SCHEMA_V2_REGISTRY_INVALID'; end if;

  previous_config:=jsonb_build_object(
    'schemaVersion',1,'mallDisplayName','历史契约商城','themePreset','smart-blue',
    'announcement','历史公告',
    'hero',jsonb_build_object('title','历史福利季','subtitle','历史精选'),
    'entries',jsonb_build_array(
      jsonb_build_object('key','enterprise','label','企业专区','visible',true,'sortOrder',1),
      jsonb_build_object('key','city','label','城市专区','visible',true,'sortOrder',2),
      jsonb_build_object('key','voucher','label','电子卡券','visible',true,'sortOrder',3),
      jsonb_build_object('key','partner','label','合作商','visible',true,'sortOrder',4)
    ),
    'partners',jsonb_build_array('全部','沃尔玛'),
    'segments',jsonb_build_array(
      jsonb_build_object('key','grocery','title','商超到家','description','生鲜百货','visible',true,'sortOrder',1),
      jsonb_build_object('key','life','title','生活服务','description','便捷到家','visible',true,'sortOrder',2),
      jsonb_build_object('key','digital','title','数码办公','description','高效办公','visible',true,'sortOrder',3),
      jsonb_build_object('key','dining','title','餐饮福利','description','员工专享','visible',true,'sortOrder',4)
    ),
    'memberCodeCta',jsonb_build_object(
      'title','到店出示会员码','description','合作门店身份与权益核验 · 不是支付码'
    ),
    'recommendationLimit',2
  );
  migrated:=public.api_mall_application_config_to_v2(previous_config);
  if migrated->>'schemaVersion'<>'2'
     or migrated#>>'{pages,0,blocks,1,text}'<>'历史公告'
     or not public.api_mall_application_config_v2_is_valid(migrated)
  then raise exception 'CONTRACT_V1_MIGRATOR_INVALID'; end if;
  if public.api_mall_application_config_to_v2(previous_config||jsonb_build_object('script','unsafe')) is not null
  then raise exception 'CONTRACT_V1_UNKNOWN_FIELD_ACCEPTED'; end if;
  if public.api_mall_application_config_v2_is_valid(
    jsonb_set(current_config,'{pages,0,blocks,0,action}',
      '{"type":"link","url":"javascript:alert(1)"}'::jsonb)
  ) then raise exception 'CONTRACT_UNSAFE_LINK_ACCEPTED'; end if;
  if public.api_mall_application_config_v2_is_valid(
    jsonb_set(current_config,'{pages,0,blocks,0,type}','"remote_script"'::jsonb)
  ) then raise exception 'CONTRACT_UNREGISTERED_COMPONENT_ACCEPTED'; end if;
  if public.api_mall_application_config_v2_is_valid(
    jsonb_set(current_config,'{pages,0,blocks,0,title}','123'::jsonb)
  ) then raise exception 'CONTRACT_NON_STRING_COMPONENT_TEXT_ACCEPTED'; end if;
  if public.api_mall_application_config_v2_is_valid(
    jsonb_set(current_config,'{pages,0,blocks,0,action}',
      '{"type":"product","targetId":123}'::jsonb)
  ) then raise exception 'CONTRACT_NON_STRING_ACTION_TARGET_ACCEPTED'; end if;
  if public.api_mall_application_config_to_v2(
    jsonb_set(previous_config,'{entries,0,label}','123'::jsonb)
  ) is not null then raise exception 'CONTRACT_V1_NON_STRING_TEXT_ACCEPTED'; end if;

  select membership.authz_version,credential.credential_version
  into strict authz_version,credential_version
  from public.memberships membership
  left join public.member_credentials credential on credential.member_id=membership.member_id
  where membership.id='membership-test-manager-admin';
  insert into public.auth_sessions(
    id,member_id,membership_id,target,credential_version,ip_hash,user_agent,device_label,expires_at
  ) values (
    session_id,'member-test-manager','membership-test-manager-admin','admin',credential_version,
    'mall-schema-contract-ip','contract-test','contract-test',now()+interval '1 hour'
  );
  read_evidence:=jsonb_build_object(
    'sessionId',session_id,'membershipId','membership-test-manager-admin',
    'authzVersion',authz_version,'permission','mall.read'
  );
  decorate_evidence:=read_evidence||jsonb_build_object('permission','mall.decorate');
  center:=public.api_mall_application_center(
    'tenant-smart-wing','enterprise-demo','mall-demo','user-test-manager',
    'membership-test-manager-admin','mall.read',read_evidence
  );
  if center#>>'{componentRegistry,schemaVersion}'<>'2'
     or exists(
       select 1 from jsonb_array_elements(center->'malls') mall
       where mall#>>'{draftVersion,config,schemaVersion}'<>'2'
          or mall#>>'{publishedVersion,config,schemaVersion}'<>'2'
     )
  then raise exception 'CONTRACT_CENTER_EXPOSED_UNPARSED_CONFIG'; end if;
  if public.api_mall_application_experience('tenant-smart-wing','mall-demo')->>'schemaVersion'<>'2'
  then raise exception 'CONTRACT_PUBLISHED_EXPERIENCE_NOT_V2'; end if;

  begin
    perform public.api_mutate_mall_application(
      'save','tenant-smart-wing','enterprise-demo','mall-demo','user-test-manager',
      'membership-test-manager-admin','mall-demo',current_config,
      (select row_version from public.mall_application_heads where mall_id='mall-demo'),
      '','拒绝缺失会话证据的草稿保存','mall-denied-'||suffix,'hash-denied-'||suffix,
      'mall-denied-contract','contract-test',decorate_evidence-'sessionId'
    );
    raise exception 'CONTRACT_UNTRACKED_SESSION_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%MALL_APPLICATION_SCOPE_FORBIDDEN%' then raise; end if;
  end;
end;
$$;

rollback;
