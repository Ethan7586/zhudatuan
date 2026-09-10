begin;

-- Deterministic hierarchy. New structural roots use the Unix epoch; all business rows preserve source timestamps.
insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
values('organization-platform-root','platform',null,'福利商城平台','Asia/Shanghai','active',0,'1970-01-01T00:00:00Z','1970-01-01T00:00:00Z');
insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
select tenant.id,'tenant','organization-platform-root',tenant.name,'Asia/Shanghai',tenant.status,0,tenant.created_at,tenant.updated_at from public.tenants tenant;
insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
select enterprise.id,'enterprise',enterprise.tenant_id,enterprise.name,'Asia/Shanghai',enterprise.status,0,enterprise.created_at,enterprise.updated_at from public.enterprises enterprise;
insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
select mall.id,'mall',mall.enterprise_id,mall.name,'Asia/Shanghai',mall.status,0,mall.created_at,mall.updated_at from public.malls mall;
insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
select department.id,'department',coalesce(department.parent_id,department.enterprise_id),department.name,'Asia/Shanghai','active',0,department.created_at,department.created_at from public.departments department;
insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
select distributor.id,'distributor','organization-platform-root',distributor.name,'Asia/Shanghai',
  case distributor.status when 'active' then 'active' when 'draft' then 'draft' else 'disabled' end,0,distributor.created_at,distributor.updated_at
from public.distributors distributor;
update organization.organization tenant set parent_id=binding.distributor_id
from public.distributor_tenants binding where tenant.id=binding.tenant_id and tenant.kind='tenant' and binding.status='active';
with recursive closure(ancestor_id,descendant_id,depth) as (
  select id,id,0 from organization.organization
  union all
  select closure.ancestor_id,child.id,closure.depth+1
  from closure join organization.organization child on child.parent_id=closure.descendant_id
)
insert into organization.unitclosure select ancestor_id,descendant_id,depth from closure;
insert into organization.sourcebinding(source_type,source_id,organization_id,source_code)
select source.source_type,source.source_id,source.source_id,source.code from public.org_units source
where source.source_type in('tenant','enterprise','mall','department')
  and exists(select 1 from organization.organization target where target.id=source.source_id);
insert into organization.sourcebinding(source_type,source_id,organization_id,source_code)
select 'orgunit',source.id,'organization-platform-root',source.code from public.org_units source where source.kind='platform';
insert into organization.sourcebinding(source_type,source_id,organization_id,source_code)
select 'distributor',source.id,source.id,source.code from public.distributors source;
insert into organization.assignment(parent_id,child_id,kind,status,evidence,effective_at,expires_at,created_at,updated_at)
select source.distributor_id,source.tenant_id,'distribution',source.status,source.agreement_evidence_json,
  source.starts_at,source.ends_at,source.created_at,source.updated_at from public.distributor_tenants source;

do $$ begin
  if (select count(*) from runtime.distributorcontactstage)<>(select count(*) from public.distributors where contact_json<>'{}'::jsonb)
     or exists(select 1 from public.distributors source left join runtime.distributorcontactstage stage on stage.distributor_id=source.id
       where source.contact_json<>'{}'::jsonb and stage.distributor_id is null)
  then raise exception 'DISTRIBUTOR_CONTACT_SECURE_STAGE_INCOMPLETE'; end if;
end $$;
insert into channel.distributor(id,organization_id,code,name,contact_ciphertext,contact_token,contact_key_version,settlement_mode,metadata,status,created_at,updated_at)
select source.id,source.id,source.code,source.name,stage.contact_ciphertext,stage.contact_token,stage.key_version,source.settlement_mode,source.metadata_json,
  source.status,source.created_at,source.updated_at from public.distributors source
left join runtime.distributorcontactstage stage on stage.distributor_id=source.id;
insert into channel.tenantbinding(id,distributor_id,tenant_id,state,evidence,effective_at,expires_at,created_at,updated_at)
select 'binding:'||md5(source.distributor_id||':'||source.tenant_id||':'||source.starts_at::text),source.distributor_id,source.tenant_id,source.status,source.agreement_evidence_json,source.starts_at,source.ends_at,source.created_at,source.updated_at
from public.distributor_tenants source;

insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
select member.id,case member.status when 'active' then 'active' else 'disabled' end,
  coalesce(credential.credential_version,1),member.created_at,member.updated_at,0
from public.members member left join public.member_credentials credential on credential.member_id=member.id
where not exists(select 1 from public.member_login_aliases alias where alias.member_id=member.id and alias.provider='test');
insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,encrypted_secret,status,rotated_at,created_at)
select 'credential:password:'||credential.member_id,credential.member_id,'password',encode(digest(credential.member_id,'sha256'),'hex'),
  credential.password_hash,credential.phone_cipher::text,'active',credential.password_changed_at,credential.created_at
from public.member_credentials credential join identity.principal principal on principal.id=credential.member_id;
insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,encrypted_secret,status,rotated_at,created_at)
select 'credential:alias:'||md5(alias.provider||':'||alias.subject),alias.member_id,'alias.'||regexp_replace(lower(alias.provider),'[^a-z0-9]+','','g'),
  encode(digest(alias.subject,'sha256'),'hex'),null,null,'active',null,alias.created_at
from public.member_login_aliases alias join identity.principal principal on principal.id=alias.member_id
where alias.provider<>'test';
insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,encrypted_secret,status,rotated_at,created_at)
select 'credential:totp:'||factor.id,member.id,'totp',encode(digest(factor.user_id,'sha256'),'hex'),null,factor.secret_ciphertext,
  case factor.status when 'active' then 'active' else 'revoked' end,factor.last_verified_at,factor.created_at
from public.admin_mfa_factors factor join public.members member on member.user_id=factor.user_id
join identity.principal principal on principal.id=member.id;
do $$ begin
  if (select count(*) from runtime.wechatidentitystage)<>(select count(*) from public.member_wechat_identities)
     or exists(select 1 from public.member_wechat_identities source left join runtime.wechatidentitystage stage on stage.identity_id=source.id::text where stage.identity_id is null)
  then raise exception 'WECHAT_IDENTITY_SECURE_STAGE_INCOMPLETE'; end if;
end $$;
insert into identity.federatedidentity(id,principal_id,membership_id,provider,application_hash,subject_hash,union_hash,subject_ciphertext,subject_key_version,status,bound_at,revoked_at,created_at,updated_at)
select source.id::text,source.member_id,source.membership_id,'wechat',encode(digest(source.app_id,'sha256'),'hex'),
  stage.subject_token,stage.union_token,stage.subject_ciphertext,stage.key_version,
  case when source.revoked_at is not null then 'revoked' when source.member_id is null then 'unbound' else 'active' end,
  source.bound_at,source.revoked_at,source.created_at,source.updated_at
from public.member_wechat_identities source join runtime.wechatidentitystage stage on stage.identity_id=source.id::text
where source.member_id is null or exists(select 1 from identity.principal principal where principal.id=source.member_id);

insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
select member.id,member.id,coalesce(source.display_name,member.primary_identifier,member.id),
  case member.status when 'active' then 'active' else 'disabled' end,member.created_at,member.updated_at,0
from public.members member left join public.users source on source.id=member.user_id
join identity.principal principal on principal.id=member.id;
update member.profile target set
  mobile_ciphertext=credential.phone_cipher::text,
  mobile_token=(select encode(digest(alias.subject,'sha256'),'hex') from public.member_login_aliases alias
    where alias.member_id=target.id and alias.provider='local_phone' limit 1)
from public.member_credentials credential where credential.member_id=target.id;
insert into member.membership(id,member_id,organization_id,client,employee_no,status,access_version,joined_at,left_at)
select membership.id,membership.member_id,coalesce(membership.mall_id,membership.enterprise_id,membership.tenant_id),case membership.target when 'storefront' then 'storefront' else 'operator' end,source.employee_no,
  case membership.status when 'active' then 'active' when 'invited' then 'invited' when 'offboarded' then 'left' else 'suspended' end,
  membership.authz_version,membership.created_at,case when membership.status='offboarded' then membership.updated_at end
from public.memberships membership left join public.users source on source.id=membership.context_user_id
join member.profile profile on profile.id=membership.member_id;

insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,ip_hash,user_agent,device_label,assurance_level,expires_at,revoked_at,revoked_reason,last_seen_at,created_at)
select source.id::text,source.member_id,source.membership_id,encode(digest(source.id::text,'sha256'),'hex'),
  coalesce(source.credential_version,principal.credential_version),membership.access_version,
  case source.target when 'storefront' then 'storefront' else 'operator' end,
  encode(digest(source.ip_hash,'sha256'),'hex'),source.user_agent,source.device_label,
  case when assurance.phone_verified_at is not null then 2 else 1 end,source.expires_at,source.revoked_at,source.revoked_reason,source.last_seen_at,source.created_at
from public.auth_sessions source join identity.principal principal on principal.id=source.member_id
join member.membership membership on membership.id=source.membership_id
left join public.member_identity_assurances assurance on assurance.member_id=source.member_id;

insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,attempts,expires_at,consumed_at,created_at)
select source.id::text,alias.member_id,source.purpose,encode(digest(source.phone_subject,'sha256'),'hex'),source.code_hash,source.attempts,
  source.expires_at,source.consumed_at,source.created_at from public.phone_verification_challenges source
left join public.member_login_aliases alias on alias.provider='local_phone' and alias.subject=source.phone_subject
  and exists(select 1 from identity.principal principal where principal.id=alias.member_id);
insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,attempts,expires_at,consumed_at,created_at)
select 'wechat:'||source.id,identity.principal_id,'wechat_binding',encode(digest(source.identity_id::text,'sha256'),'hex'),
  encode(digest(source.id::text,'sha256'),'hex'),0,source.expires_at,source.consumed_at,source.created_at
from public.wechat_binding_challenges source join identity.federatedidentity identity on identity.id=source.identity_id::text;
insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,attempts,expires_at,consumed_at,created_at)
select 'stepup:'||source.id,membership.member_id,'admin_stepup',encode(digest(source.session_id,'sha256'),'hex'),
  encode(digest(source.factor_id,'sha256'),'hex'),source.attempts,source.expires_at,source.verified_at,source.created_at
from public.admin_step_up_challenges source join member.membership membership on membership.id=source.membership_id;

insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
select 'assurance:account:'||source.member_id,source.member_id,'password',1,
  encode(digest(source.member_id||':'||source.account_authenticated_at::text,'sha256'),'hex'),source.account_authenticated_at,null
from public.member_identity_assurances source join identity.principal principal on principal.id=source.member_id;
insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
select 'assurance:phone:'||source.member_id,source.member_id,coalesce(source.phone_verification_method,'phone'),2,
  encode(digest(source.member_id||':'||source.phone_verified_at::text,'sha256'),'hex'),source.phone_verified_at,null
from public.member_identity_assurances source join identity.principal principal on principal.id=source.member_id
where source.phone_verified_at is not null;
insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
select 'assurance:totp:'||source.id,member.id,'totp',3,encode(digest(source.id||':'||source.last_verified_at::text,'sha256'),'hex'),
  source.last_verified_at,null from public.admin_mfa_factors source join public.members member on member.user_id=source.user_id
join identity.principal principal on principal.id=member.id where source.last_verified_at is not null;

insert into identity.loginattempt(subject_hash,client_hash,window_started_at,failures,locked_until)
select encode(digest(source.ip_hash,'sha256'),'hex'),encode(digest('login','sha256'),'hex'),source.window_started_at,source.failed_attempts,source.blocked_until
from public.login_attempts source;
insert into identity.loginattempt(subject_hash,client_hash,window_started_at,failures,locked_until)
select encode(digest(source.ip_hash,'sha256'),'hex'),encode(digest('registration','sha256'),'hex'),source.window_started_at,source.attempt_count,source.blocked_until
from public.username_registration_attempts source;
insert into identity.registrationpolicy(id,version,terms_version,terms_title,terms_body,privacy_title,privacy_body,terms_hash,effective_at,retired_at)
select 'registration:'||source.terms_version,1,source.terms_version,source.terms_title,source.terms_body,source.privacy_title,source.privacy_body,
  encode(digest(source.terms_version||':'||source.terms_body||':'||source.privacy_body,'sha256'),'hex'),source.updated_at,null
from public.registration_terms_policy source;

insert into access.permission(id,code,risk,status)
select distinct on(normalized.code) permission.id,normalized.code,
  case permission.risk_level when 'low' then 'low' when 'medium' then 'medium' when 'high' then 'high' when 'critical' then 'critical' when 'elevated' then 'high' else 'medium' end,'active'
from public.permissions permission cross join lateral(values(regexp_replace(replace(lower(permission.code),':','.'),'[^a-z0-9.]+','','g'))) normalized(code)
order by normalized.code,permission.id;
insert into access.role(id,scope_id,name,status,version)
select role.id,role.tenant_id,role.name,coalesce(role.status,'active'),0 from public.roles role;
insert into access.rolepermission(role_id,permission_id,effect)
select distinct mapping.role_id,target.id,'allow' from public.role_permissions mapping join public.permissions source on source.id=mapping.permission_id
join access.permission target on target.code=regexp_replace(replace(lower(source.code),':','.'),'[^a-z0-9.]+','','g');
insert into access.membershiprole(membership_id,role_id,effective_at,expires_at,delegated_by)
select source.membership_id,source.role_id,source.granted_at,source.expires_at,source.granted_by_membership_id
from public.membership_roles source join member.membership membership on membership.id=source.membership_id where source.revoked_at is null;
insert into access.membershiprole(membership_id,role_id,effective_at,expires_at,delegated_by)
select membership.id,source.role_id,membership.joined_at,null,null from public.user_roles source
join public.memberships legacy on legacy.context_user_id=source.user_id and legacy.tenant_id=source.tenant_id
join member.membership membership on membership.id=legacy.id
where not exists(select 1 from access.membershiprole target where target.membership_id=membership.id and target.role_id=source.role_id);
insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,expires_at,access_version)
select 'scope:'||membership_id||':'||scope_kind||':'||resource_id,membership_id,scope_kind,resource_id,
  coalesce((select string_agg(ancestor_id,'/' order by depth desc) from organization.unitclosure where descendant_id=resource_id),resource_id),
  'allow',created_at,null,(select authz_version from public.memberships where id=membership_id)
from public.membership_scopes source where exists(select 1 from member.membership membership where membership.id=source.membership_id);
insert into access.membershipoverride(membership_id,permission_id,effect,granted_by,reason,effective_at,expires_at,revoked_at)
select source.membership_id,target.id,source.effect,source.granted_by_membership_id,source.reason,source.created_at,source.expires_at,source.revoked_at
from public.membership_permission_overrides source join public.permissions legacy on legacy.id=source.permission_id
join access.permission target on target.code=regexp_replace(replace(lower(legacy.code),':','.'),'[^a-z0-9.]+','','g')
where exists(select 1 from member.membership membership where membership.id=source.membership_id);

insert into member.invite(id,organization_id,destination_hash,token_hash,expires_at,accepted_at,created_by,role_id,allowed_destination_hash,max_uses,use_count,effective_at,status)
select source.id,source.mall_id,encode(digest(coalesce(source.allowed_phone_subject,source.id),'sha256'),'hex'),
  encode(digest(source.code_hash,'sha256'),'hex'),source.expires_at,
  case when source.use_count>=source.max_uses then source.expires_at end,coalesce(source.created_by_membership_id,'system'),source.role_id,
  case when source.allowed_phone_subject is null then null else encode(digest(source.allowed_phone_subject,'sha256'),'hex') end,
  source.max_uses,source.use_count,source.starts_at,source.status
from public.membership_registration_invites source;
insert into member.importjob(id,organization_id,object_ref,sha256,state,cursor_value,total_count,success_count,failure_count,created_at,updated_at)
select source.id,source.mall_id,'legacy://membership-import/'||source.id||'/'||source.source_name,
  encode(digest(source.id||':'||source.source_name||':'||source.total_rows::text||':'||source.created_at::text,'sha256'),'hex'),
  case source.status when 'completed' then 'completed' when 'partial' then 'completed' else 'failed' end,null,
  source.total_rows,source.success_rows,source.failed_rows,source.created_at,source.created_at
from public.membership_import_jobs source;
insert into member.importerror(job_id,row_number,reason_code,field,detail)
select source.job_id,source.row_number,source.error_code,null,source.message from public.membership_import_errors source;

insert into partner.partner(id,scope_id,kind,name,status,version,created_at,updated_at)
select supplier.id,supplier.tenant_id,'supplier',supplier.name,case supplier.status when 'active' then 'active' else 'suspended' end,0,supplier.created_at,supplier.created_at
from public.suppliers supplier;
insert into partner.partner(id,scope_id,kind,name,status,version,created_at,updated_at)
select source.id,source.tenant_id,'brand',source.name,
  case source.status when 'active' then 'active' when 'draft' then 'pending' else 'terminated' end,0,source.created_at,source.updated_at
from public.brands source;
insert into partner.brand(id,owner_partner_id,code)
select source.id,null,source.code from public.brands source;

do $$ begin
  if (select count(*) from runtime.partneraddressstage)<>(select count(*) from public.stores where address_text is not null)
     or exists(select 1 from public.stores source left join runtime.partneraddressstage stage on stage.store_id=source.id
       where source.address_text is not null and stage.store_id is null)
  then raise exception 'PARTNER_ADDRESS_SECURE_STAGE_INCOMPLETE'; end if;
end $$;
insert into partner.partner(id,scope_id,kind,name,status,version,created_at,updated_at)
select source.id,source.tenant_id,'store',source.name,
  case source.status when 'active' then 'active' when 'draft' then 'pending' else 'terminated' end,0,source.created_at,source.updated_at
from public.stores source;
insert into partner.store(id,mall_id,region_code,address_ciphertext,address_token,address_key_version,service_radius_meters)
select source.id,null,coalesce(source.city_code,source.province_code,'global'),
  stage.address_ciphertext,stage.address_token,stage.key_version,null from public.stores source
left join runtime.partneraddressstage stage on stage.store_id=source.id;
insert into partner.relationship(id,scope_id,left_partner_id,right_partner_id,kind,evidence,effective_at,expires_at,status,created_at,updated_at)
select 'supplier-brand:'||source.supplier_id||':'||source.brand_id,source.tenant_id,source.supplier_id,source.brand_id,
  source.relationship_kind,source.evidence_json,source.starts_at,source.ends_at,
  case source.status when 'active' then 'active' when 'expired' then 'expired' when 'draft' then 'draft' else 'terminated' end,
  source.created_at,source.updated_at from public.supplier_brand_bindings source;
insert into partner.relationship(id,scope_id,left_partner_id,right_partner_id,kind,evidence,effective_at,expires_at,status,created_at,updated_at)
select 'brand-store:'||source.brand_id||':'||source.store_id,source.tenant_id,source.brand_id,source.store_id,
  source.relationship_kind,'{}'::jsonb,source.starts_at,source.ends_at,
  case source.status when 'active' then 'active' when 'expired' then 'expired' when 'draft' then 'draft' else 'terminated' end,
  source.created_at,source.updated_at from public.brand_store_bindings source;
insert into partner.agreement(id,partner_id,mall_id,contract_ref,contract_hash,capabilities,effective_at,expires_at,status)
select source.id,source.supplier_id,source.mall_id,source.agreement_code,
  encode(digest(source.terms_json::text,'sha256'),'hex'),jsonb_build_array('catalog','order','fulfillment'),
  coalesce(source.starts_at,source.created_at),source.ends_at,
  case source.status when 'active' then 'active' when 'expired' then 'expired' when 'draft' then 'draft' else 'terminated' end
from public.mall_supplier_agreements source;
insert into partner.agreement(id,partner_id,mall_id,contract_ref,contract_hash,capabilities,effective_at,expires_at,status)
select source.id,source.brand_id,source.mall_id,'brand-authorization:'||source.id,
  encode(digest(source.evidence_json::text,'sha256'),'hex'),jsonb_build_array('catalog'),coalesce(source.starts_at,source.created_at),source.ends_at,
  case source.status when 'active' then 'active' when 'expired' then 'expired' when 'draft' then 'draft' else 'terminated' end
from public.mall_brand_authorizations source;
insert into partner.servicebinding(store_id,organization_id,service,status,effective_at,expires_at)
select source.store_id,binding.organization_id,source.service_kind,source.status,source.starts_at,source.ends_at
from public.store_org_unit_bindings source join public.org_units unit on unit.id=source.org_unit_id
join organization.sourcebinding binding on binding.source_type=unit.source_type and binding.source_id=unit.source_id;

insert into catalog.category(id,parent_id,code,name,status,sort_order)
select 'category:'||md5(source.code),case when source.parent_code is null then null else 'category:'||md5(source.parent_code) end,
  source.code,source.name_zh,case source.status when 'active' then 'active' else 'disabled' end,source.sort_order
from public.catalog_taxonomy_nodes source;
insert into catalog.category(id,parent_id,code,name,status,sort_order)
select 'category:'||md5(product.category_code),null,product.category_code,product.category_code,'active',0
from public.products product where not exists(select 1 from public.catalog_taxonomy_nodes taxonomy where taxonomy.code=product.category_code)
  and product.is_test=false
group by product.category_code;
insert into catalog.product(id,owner_partner_id,brand_id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
select product.id,product.supplier_id,product.brand_id,'category:'||md5(product.category_code),coalesce(product.name_zh,product.name),'physical',
  jsonb_strip_nulls(jsonb_build_object('sourceTitle',product.name,'sourceTitleEn',product.name_en,'subtitle',product.subtitle,
    'subtitleZh',product.subtitle_zh,'detail',product.detail_json,'sourceSpu',product.spu_code,'sourceCode',product.source_code,
    'sourceSpuId',product.source_spu_id,'taxonomyVersion',product.taxonomy_version,'taxonomyL1',product.taxonomy_l1,
    'taxonomyL2',product.taxonomy_l2,'taxonomyL3',product.taxonomy_l3,'translationState',product.translation_status,
    'translationConfidence',product.translation_confidence,'classificationState',product.classification_status,
    'classificationConfidence',product.classification_confidence)),
  case product.status when 'active' then 'active' when 'inactive' then 'archived' else 'draft' end,0,product.created_at,product.updated_at
from public.products product where product.is_test=false;
insert into catalog.sku(id,product_id,code,specifications,status,version)
select sku.id,sku.product_id,sku.sku_code,sku.specs_json||jsonb_strip_nulls(jsonb_build_object('sourceCode',sku.source_code,'sourceSkuId',sku.source_sku_id)),
  case sku.status when 'active' then 'active' else 'archived' end,0 from public.skus sku
join catalog.product product on product.id=sku.product_id;
insert into catalog.suppliercategory(id,supplier_id,source_code,source_name,category_id,state,confidence,created_at,updated_at)
select source.id,source.supplier_id,source.source_category_code,source.source_category_name,'category:'||md5(source.target_taxonomy_code),
  source.mapping_status,source.confidence,source.created_at,source.updated_at from public.catalog_supplier_category_mappings source;
insert into catalog.classificationrule(id,taxonomy_version,name,source_field,match_pattern,category_id,priority,status,created_at,updated_at)
select source.id,source.taxonomy_version,source.rule_name,source.source_field,source.match_pattern,'category:'||md5(source.target_taxonomy_code),
  source.priority,source.status,source.created_at,source.updated_at from public.catalog_classification_rules source;

insert into catalog.pool(id,scope_id,kind,name,status,version)
select source.id,source.owner_id,case source.pool_kind when 'source' then 'private' when 'selected' then 'channel' else 'markup' end,
  source.name,source.status,0 from public.catalog_pools source;
insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at)
select source.pool_id,source.sku_id,case source.status when 'active' then 'included' else 'excluded' end,
  encode(digest(source.metadata_json::text||':'||coalesce(source.starts_at::text,''),'sha256'),'hex'),source.created_at
from public.catalog_pool_items source join catalog.sku sku on sku.id=source.sku_id;
insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,expires_at,created_at)
select source.mall_id,source.pool_id,source.listing_kind,source.status,source.starts_at,source.ends_at,source.created_at
from public.mall_catalog_pool_bindings source;
insert into catalog.availabilityzone(id,scope_id,mall_id,code,name,applies_to,status,effective_at,expires_at,attributes,created_at,updated_at)
select source.id,source.tenant_id,source.mall_id,source.code,source.name,source.applies_to,source.status,source.starts_at,source.ends_at,
  source.metadata_json,source.created_at,source.updated_at from public.city_zones source;
insert into catalog.availabilitycity(zone_id,code,name,city_key)
select source.zone_id,source.city_code,source.city_name,source.city_key from public.city_zone_cities source;
insert into catalog.availabilityitem(zone_id,resource_type,resource_id,created_at)
select source.zone_id,case when source.product_id is not null then 'product' else 'sku' end,
  coalesce(source.product_id,source.sku_id),source.created_at from public.city_zone_catalog_items source
where (source.product_id is not null and exists(select 1 from catalog.product product where product.id=source.product_id))
   or (source.sku_id is not null and exists(select 1 from catalog.sku sku where sku.id=source.sku_id));

insert into catalog.sourcelisting(id,provider,external_id,object_type,sku_id,scope_id,source_version,source_payload,source_hash,status,observed_at)
select 'legacy-product:'||source.id,coalesce(source.source_code,'legacy'),coalesce(source.source_spu_id,source.spu_code),'product',null,source.mall_id,
  source.updated_at::text,jsonb_build_object('productId',source.id,'sourceSpu',source.spu_code),
  encode(digest(source.id||':'||source.updated_at::text,'sha256'),'hex'),'mapped',source.updated_at
from public.products source where source.is_test=false;
insert into catalog.review(id,listing_id,state,reason,reviewer_id,decided_at)
select source.id,'legacy-product:'||source.product_id,
  case source.status when 'approved' then 'approved' when 'rejected' then 'rejected' else 'pending' end,
  source.review_note,source.reviewer_id,source.reviewed_at from public.catalog_review_queue source
join catalog.sourcelisting listing on listing.id='legacy-product:'||source.product_id;
insert into pricing.pricebook(id,scope_id,currency,name,status,version)
select 'pricebook:'||mall.id,mall.id,'CNY','默认价格簿','active',1 from public.malls mall;
insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at,expires_at)
select 'price:'||sku.id,'pricebook:'||sku.mall_id,sku.id,sku.price_cents,sku.market_price_cents,sku.created_at,null
from public.skus sku join catalog.sku target on target.id=sku.id;

insert into qualification.profile(member_id,scope_id,city_code,city_name,attributes,status,version,updated_at)
select member.id,source.tenant_id,source.city_code,source.city_name,source.attributes_json,source.status,source.version,source.updated_at
from public.employee_qualification_profiles source join public.members member on member.user_id=source.user_id
join member.profile target on target.id=member.id;
insert into qualification.tag(member_id,code,source,effective_at,expires_at,created_at)
select member.id,source.tag_code,source.source,source.starts_at,source.ends_at,source.created_at
from public.employee_qualification_tags source join public.members member on member.user_id=source.user_id
join qualification.profile profile on profile.member_id=member.id;

insert into qualification.policy(id,scope_id,name,status,active_version,created_at,updated_at)
select source.id,coalesce(source.mall_id,source.tenant_id),source.name,
  case source.status when 'active' then 'published' when 'disabled' then 'retired' else 'draft' end,
  case when source.status='active' then source.version::integer end,source.created_at,source.updated_at
from public.entitlement_policies source;
insert into qualification.policyversion(policy_id,version,rule,rule_hash,published_at,created_by)
select source.id,source.version::integer,
  source.conditions_json||jsonb_build_object('action',source.action,'effect',source.effect,'priority',source.priority,'reasonCode',source.reason_code,
    'effectiveAt',source.starts_at,'expiresAt',source.ends_at),
  encode(digest((source.conditions_json||jsonb_build_object('action',source.action,'effect',source.effect,'priority',source.priority,'reasonCode',source.reason_code))::text,'sha256'),'hex'),
  case when source.status='active' then coalesce(source.starts_at,source.updated_at) end,coalesce(source.created_by_membership_id,'system')
from public.entitlement_policies source;
insert into qualification.subject(policy_id,policy_version,kind,selector)
select source.policy_id,policy.version::integer,source.subject_kind,jsonb_build_object('id',source.subject_id)
from public.entitlement_policy_subjects source join public.entitlement_policies policy on policy.id=source.policy_id;
insert into qualification.resource(policy_id,policy_version,kind,resource_id)
select source.policy_id,policy.version::integer,source.resource_kind,source.resource_id
from public.entitlement_policy_resources source join public.entitlement_policies policy on policy.id=source.policy_id;

insert into qualification.policy(id,scope_id,name,status,active_version,created_at,updated_at)
select 'limit:'||source.id,coalesce(source.mall_id,source.tenant_id),source.name,
  case source.status when 'active' then 'published' when 'disabled' then 'retired' else 'draft' end,
  case when source.status='active' then source.version::integer end,source.created_at,source.updated_at
from public.purchase_limit_templates source;
insert into qualification.policyversion(policy_id,version,rule,rule_hash,published_at,created_by)
select 'limit:'||source.id,source.version::integer,
  source.metadata_json||jsonb_build_object('countScope',source.count_scope,'effectiveAt',source.starts_at,'expiresAt',source.ends_at),
  encode(digest((source.metadata_json||jsonb_build_object('countScope',source.count_scope))::text,'sha256'),'hex'),
  case when source.status='active' then coalesce(source.starts_at,source.updated_at) end,'system'
from public.purchase_limit_templates source;
insert into qualification.subject(policy_id,policy_version,kind,selector)
select 'limit:'||source.template_id,template.version::integer,source.subject_kind,jsonb_build_object('id',source.subject_id)
from public.purchase_limit_subjects source join public.purchase_limit_templates template on template.id=source.template_id;
insert into qualification.resource(policy_id,policy_version,kind,resource_id)
select 'limit:'||source.template_id,template.version::integer,source.resource_kind,source.resource_id
from public.purchase_limit_resources source join public.purchase_limit_templates template on template.id=source.template_id;
insert into qualification.purchaselimit(policy_id,policy_version,period,quantity,amount_minor,currency)
select 'limit:'||source.id,source.version::integer,limits.period,limits.quantity,limits.amount_minor,
  case when limits.amount_minor is null then null else 'CNY' end
from public.purchase_limit_templates source cross join lateral(values
  ('order',source.max_per_order_qty::bigint,source.max_per_order_amount_cents),
  ('day',source.max_daily_qty::bigint,source.max_daily_amount_cents),
  ('month',source.max_monthly_qty::bigint,source.max_monthly_amount_cents),
  ('lifetime',source.max_lifetime_qty::bigint,source.max_lifetime_amount_cents)
) limits(period,quantity,amount_minor) where limits.quantity is not null or limits.amount_minor is not null;

insert into qualification.changerequest(id,policy_id,target_kind,target_id,proposed_version,state,requested_by,decided_by,requested_at,decided_at,reason,risk,proposal,preview,decision_reason,applied_result,idempotency_key,request_hash)
select source.id,
  case when source.config_kind='entitlement_policy' and exists(select 1 from qualification.policy policy where policy.id=source.entity_id) then source.entity_id
    when source.config_kind='purchase_limit' and exists(select 1 from qualification.policy policy where policy.id='limit:'||source.entity_id) then 'limit:'||source.entity_id end,
  source.config_kind,source.entity_id,source.expected_version::integer+1,
  case source.status when 'pending' then 'submitted' when 'applied' then 'applied' when 'rejected' then 'rejected' else 'rejected' end,
  source.requested_by_membership_id,source.reviewed_by_membership_id,source.created_at,coalesce(source.reviewed_at,source.applied_at),source.reason,
  case source.risk_level when 'critical' then 'critical' else 'high' end,source.payload_json,source.preview_json,source.review_reason,
  source.applied_result_json,source.idempotency_key,encode(digest(source.request_hash,'sha256'),'hex')
from public.qualification_change_requests source;

insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
select stock.id,stock.mall_id,stock.sku_id,stock.location_id,stock.onhand,stock.safety,stock.version,
  case stock.cutover_status when 'ready' then 'active' else 'blocked' end,stock.updated_at from inventory.stock_items stock
join catalog.sku sku on sku.id=stock.sku_id;
insert into inventory.reservation(id,stockitem_id,owner_type,owner_id,quantity,state,expires_at,created_at,version)
select reservation.id,reservation.stock_item_id,'order',reservation.order_id,reservation.quantity,reservation.state,reservation.expires_at,reservation.created_at,reservation.version
from inventory.reservations reservation join inventory.stockitem stock on stock.id=reservation.stock_item_id;
insert into inventory.movement(id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
select movement.id,movement.stock_item_id,
  case movement.kind when 'sale' then 'commit' else movement.kind end,
  case when movement.kind in('reserve','sale') then -movement.quantity else movement.quantity end,
  case when movement.reservation_id is null then 'order' else 'reservation' end,
  coalesce(movement.reservation_id,movement.order_id),movement.occurred_at from inventory.movements movement
join inventory.stockitem stock on stock.id=movement.stock_item_id;
insert into inventory.command(id,scope_id,operation,idempotency_key,request,response,created_at,completed_at)
select source.id,source.mall_id,source.operation,source.idempotency_key,source.request_json,source.response_json,source.created_at,source.completed_at
from inventory.commands source;
insert into inventory.snapshot(stockitem_id,observed_at,source,onhand,source_version)
select source.stock_item_id,source.observed_at,source.source_kind,source.observed_onhand,
  encode(digest(source.id||':'||source.recorded_at::text,'sha256'),'hex')
from inventory.observations source join inventory.stockitem stock on stock.id=source.stock_item_id where source.observation_kind='stock_snapshot';
insert into inventory.observation(id,stockitem_id,kind,source,source_reference,observed_onhand,observed_quantity,disposition,evidence,observed_at,recorded_at)
select source.id,source.stock_item_id,case source.observation_kind when 'stock_snapshot' then 'stock' else 'return' end,
  source.source_kind,source.source_reference,source.observed_onhand,source.observed_quantity,source.disposition,source.payload_json,
  source.observed_at,source.recorded_at from inventory.observations source join inventory.stockitem stock on stock.id=source.stock_item_id;
insert into inventory.syncstate(scope_id,source,source_reference,location_id,cursor_value,state,observed_count,applied_count,failed_count,last_error,version,started_at,completed_at,updated_at)
select source.mall_id,source.source_kind,source.source_reference,source.location_id,source.cursor_value,source.state,source.observed_count,
  source.applied_count,source.failed_count,source.last_error,source.version,source.started_at,source.completed_at,source.updated_at
from inventory.sync_states source;
insert into inventory.cutoverreview(id,stockitem_id,source_relation,legacy_available,legacy_reserved,reason,state,evidence,captured_at,reviewed_at,reviewed_by)
select source.id,source.stock_item_id,'cutover:'||source.source_relation,source.legacy_available,source.legacy_reserved,source.reason,'open','{}'::jsonb,
  source.captured_at,null,null from inventory.cutover_records source join inventory.stockitem stock on stock.id=source.stock_item_id;
insert into inventory.cutoverreview(id,stockitem_id,source_relation,legacy_available,legacy_reserved,reason,state,evidence,captured_at,reviewed_at,reviewed_by)
select source.id,source.stock_item_id,'review:'||source.action,source.legacy_available,source.legacy_reserved,source.review_reference,'approved',source.evidence_json,
  source.created_at,source.created_at,source.actor_membership_id from inventory.cutover_reviews source join inventory.stockitem stock on stock.id=source.stock_item_id;

insert into experience.application(id,scope_id,name,status,head_version_id,created_at,updated_at,version)
select 'application:'||head.mall_id,head.mall_id,mall.name,'active',head.published_version_id,
  (select min(version.created_at) from public.mall_application_versions version where version.mall_id=head.mall_id),head.updated_at,head.row_version
from public.mall_application_heads head join public.malls mall on mall.id=head.mall_id;
insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,created_by,created_at)
select version.id,'application:'||version.mall_id,version.version_no,coalesce(version.config_json->>'schemaVersion','1'),version.config_json,
  encode(digest(version.config_json::text,'sha256'),'hex'),'valid',
  coalesce(version.created_by_user_id,'system'),version.created_at from public.mall_application_versions version;

insert into cart.cart(id,member_id,mall_id,application_id,state,version,updated_at)
select source.id,coalesce(member.id,'member-'||source.user_id),source.mall_id,'application:'||source.mall_id,'active',0,source.updated_at
from public.carts source join public.members member on member.user_id=source.user_id
join member.profile profile on profile.id=member.id;
insert into cart.item(cart_id,listing_id,sku_id,quantity,listing_version,version)
select item.cart_id,'listing:'||item.sku_id,item.sku_id,item.quantity,'legacy',0 from public.cart_items item
join cart.cart cart on cart.id=item.cart_id join catalog.sku sku on sku.id=item.sku_id;

insert into checkout.address(id,member_id,recipient_ciphertext,mobile_ciphertext,address_ciphertext,region_token,address_token,status,version)
select source.id,member.id,source.recipient_cipher::text,source.recipient_cipher::text,source.recipient_cipher::text,
  encode(digest(source.tenant_id||':'||source.enterprise_id||':'||source.mall_id,'sha256'),'hex'),
  encode(digest(source.recipient_cipher::text,'sha256'),'hex'),'active',0
from public.delivery_addresses source join public.members member on member.user_id=source.user_id
join member.profile profile on profile.id=member.id;

insert into pricing.quote(id,member_id,mall_id,currency,subtotal_minor,discount_minor,payable_minor,lines,evidence_hash,expires_at,created_at)
select 'legacy-quote:'||source.id,coalesce(member.id,'member-'||source.user_id),source.mall_id,'CNY',source.goods_amount_cents,source.discount_cents,source.payable_cents,
  '[]'::jsonb,encode(digest(source.id||':'||source.payable_cents::text,'sha256'),'hex'),source.created_at+interval '100 years',source.created_at
from public.orders source left join public.members member on member.user_id=source.user_id;
insert into checkout.session(id,cart_id,member_id,mall_id,quote_id,quote_hash,address_id,state,expires_at,created_at,version)
select 'legacy-checkout:'||source.id,'legacy-cart:'||source.id,coalesce(member.id,'member-'||source.user_id),source.mall_id,'legacy-quote:'||source.id,
  encode(digest(source.id||':'||source.payable_cents::text,'sha256'),'hex'),null,'confirmed',source.created_at+interval '100 years',source.created_at,0
from public.orders source left join public.members member on member.user_id=source.user_id;
insert into ordering.orderrecord(id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,payment_state,fulfillment_state,aftersale_state,lifecycle_state,evidence,created_at,updated_at,version)
select source.id,source.order_no,source.tenant_id,coalesce(member.id,'member-'||source.user_id),source.mall_id,'legacy-checkout:'||source.id,'CNY',source.payable_cents,
  case when source.status='pending_payment' then 'unpaid' when source.status='refunded' then 'refunded' when source.paid_cents>0 then 'paid' else 'failed' end,
  case source.status when 'shipped' then 'shipped' when 'completed' then 'delivered' when 'cancelled' then 'cancelled' when 'refunded' then 'returned' else 'processing' end,
  case when source.status in('refund_pending','refunded') then 'processing' else 'none' end,
  case source.status when 'completed' then 'completed' when 'cancelled' then 'cancelled' when 'refunded' then 'closed' else 'active' end,
  jsonb_build_object('source','public.orders','recipientHash',encode(digest(source.recipient_snapshot_json::text,'sha256'),'hex')),
  source.created_at,source.updated_at,0
from public.orders source left join public.members member on member.user_id=source.user_id;
insert into ordering.line(id,order_id,sku_id,listing_id,title_snapshot,quantity,unit_minor,total_minor,qualification_evidence_id,provider)
select item.id,item.order_id,item.sku_id,'listing:'||item.sku_id,item.product_name_snapshot,item.quantity,item.unit_price_cents,item.line_amount_cents,null,null from public.order_items item;
insert into ordering.suborder(id,order_id,partner_id,provider,state,version)
select source.id,source.parent_order_id,source.supplier_id,null,source.status,0 from public.sub_orders source;
insert into ordering.aftersale(id,order_id,line_id,kind,state,quantity,amount_minor,reason,created_at,updated_at,version)
select source.id,source.order_id,source.order_item_id,case source.type when 'exchange' then 'exchange' when 'return_refund' then 'return' else 'refund' end,
  case source.status when 'submitted' then 'requested' when 'approved' then 'approved' when 'rejected' then 'rejected' when 'completed' then 'completed' when 'closed' then 'cancelled' else 'processing' end,
  null,source.requested_amount_cents,source.reason,source.created_at,source.updated_at,0 from public.after_sales source;
insert into ordering.reviewaction(id,aftersale_id,previous_state,next_state,reason,evidence,actor_id,membership_id,grant_evidence,trace_id,occurred_at)
select source.id,source.after_sale_id,source.status_before,source.status_after,source.reason,source.evidence,source.actor_user_id,
  source.actor_membership_id,source.granted_via,source.request_id,source.created_at from public.after_sale_review_actions source;

insert into verification.session(id,scope_id,subject_type,subject_id,purpose,state,expires_at,version)
select source.id::text,source.mall_id,'member',source.member_id,'member_code',
  case source.status when 'active' then 'issued' when 'consumed' then 'verified' when 'revoked' then 'revoked' else 'expired' end,
  source.expires_at,source.authz_version from public.member_code_challenges source
where exists(select 1 from member.profile profile where profile.id=source.member_id);
insert into verification.nonce(session_id,nonce_hash,issued_at,consumed_at)
select source.id::text,case when source.credential_hash~'^[0-9a-f]{64}$' then source.credential_hash else encode(digest(source.credential_hash,'sha256'),'hex') end,
  source.issued_at,source.consumed_at from public.member_code_challenges source
where exists(select 1 from verification.session session where session.id=source.id::text);

insert into fulfillment.fulfillmentorder(id,order_id,suborder_id,provider,partner_id,store_id,kind,state,external_reference,payment_id,source_effect_id,amount_minor,idempotency_key,created_at,updated_at,version)
select source.id::text,source.order_id,source.sub_order_id,null,source.supplier_id,null,'shipment',
  case source.status when 'queued' then 'pending' when 'submitting' then 'submitted' when 'submitted' then 'submitted'
    when 'accepted' then 'accepted' when 'shipping' then 'processing' when 'delivered' then 'completed'
    when 'failed' then 'failed' else 'failed' end,null,source.payment_id,source.source_effect_id::text,source.amount_cents,
  source.idempotency_key,source.created_at,source.updated_at,0 from public.fulfillment_orders source;
insert into fulfillment.line(fulfillment_id,order_line_id,quantity)
select source.fulfillment_order_id::text,source.order_item_id,source.quantity from public.fulfillment_order_items source;

insert into notification.template(id,scope_id,channel,event_type,version,variable_schema,provider_template,subject,body,status)
select 'legacy-template:'||md5(source.tenant_id||':'||source.channel||':'||source.template_key),source.tenant_id,source.channel,
  source.template_key,1,'{}'::jsonb,source.template_key,null,'Legacy immutable template reference: '||source.template_key,'retired'
from public.notification_dispatches source group by source.tenant_id,source.channel,source.template_key;
insert into notification.dispatch(id,template_id,recipient_token,recipient_ciphertext,recipient_ref,payload,state,idempotency_key,available_at,created_at)
select source.id::text,'legacy-template:'||md5(source.tenant_id||':'||source.channel||':'||source.template_key),
  encode(digest(source.recipient_kind||':'||source.recipient_id,'sha256'),'hex'),null,source.recipient_kind||':'||source.recipient_id,
  source.payload_json,case source.status when 'pending' then 'queued' when 'processing' then 'sending' when 'sent' then 'sent'
    when 'failed' then 'failed' else 'failed' end,
  'legacy:'||source.source_effect_id::text||':'||source.recipient_kind||':'||source.channel,source.available_at,source.created_at
from public.notification_dispatches source;
insert into notification.attempt(id,dispatch_id,provider,external_id,state,error_code,attempted_at)
select 'legacy-attempt:'||source.id::text,source.id::text,source.channel,source.provider_reference,source.status,null,
  coalesce(source.sent_at,source.updated_at) from public.notification_dispatches source where source.attempts>0 or source.provider_reference is not null;

insert into payment.tender(id,kind,provider,currency,status)
select 'tender:'||channel,case when channel in('welfare','meal') then 'benefit' when channel='wechat' then 'wechat' else 'external' end,channel,'CNY','active'
from public.payments group by channel;
insert into payment.intent(id,order_id,member_id,currency,amount_minor,state,idempotency_key,provider_reference,expires_at,version)
select 'intent:'||source.id,source.order_id,coalesce(member.id,'member-'||source.user_id),'CNY',source.amount_cents,
  case source.status when 'succeeded' then 'captured' when 'processing' then 'authorizing' when 'closed' then 'cancelled' when 'failed' then 'failed' else 'created' end,
  source.idempotency_key,coalesce((select attempt.out_trade_no from public.wechat_payment_attempts attempt where attempt.payment_id=source.id order by attempt.created_at desc limit 1),
    upper(substr(encode(digest('legacy-payment:'||source.id::text,'sha256'),'hex'),1,32))),source.created_at+interval '100 years',0
from public.payments source left join public.members member on member.user_id=source.user_id;
insert into payment.attempt(id,intent_id,tender_id,provider,external_transaction,state,requested_at,completed_at)
select 'attempt:'||source.id,'intent:'||source.id,'tender:'||source.channel,source.channel,source.provider_trade_no,
  case source.status when 'succeeded' then 'succeeded' when 'failed' then 'failed' when 'processing' then 'pending' else 'started' end,source.created_at,source.completed_at
from public.payments source where not exists(select 1 from public.wechat_payment_attempts attempt where attempt.payment_id=source.id);
insert into payment.attempt(id,intent_id,tender_id,provider,external_transaction,state,requested_at,completed_at)
select source.id::text,'intent:'||source.payment_id,'tender:wechat','wechat',coalesce(source.transaction_id,source.out_trade_no),
  case source.status when 'succeeded' then 'succeeded' when 'prepay_failed' then 'failed' when 'failed' then 'failed'
    when 'closed' then 'failed' when 'created' then 'started' else 'pending' end,source.created_at,source.completed_at
from public.wechat_payment_attempts source;
insert into payment.observation(id,attempt_id,provider_event_id,state,amount_minor,currency,payload_hash,observed_at)
select source.provider_event_key,source.attempt_id::text,source.provider_event_id,source.trade_state,source.amount_total,'CNY',source.evidence_digest,source.received_at
from public.wechat_payment_observations source where source.attempt_id is not null;
insert into payment.payment(id,intent_id,amount_minor,currency,captured_minor,refunded_minor,state,version)
select source.id,'intent:'||source.id,source.amount_cents,'CNY',case when source.status in('succeeded','refunded') then source.amount_cents else 0 end,
  case when source.status='refunded' then source.amount_cents else 0 end,
  case source.status when 'refunded' then 'refunded' when 'succeeded' then 'captured' else 'cancelled' end,0
from public.payments source where source.status in('succeeded','refunded','closed');
insert into payment.allocation(payment_id,target_type,target_id,amount_minor,currency)
select allocation.payment_id,case when allocation.account_id is null then 'order' else 'account' end,coalesce(allocation.account_id,allocation.order_id),allocation.amount_cents,'CNY' from public.payment_allocations allocation
where exists(select 1 from payment.payment target where target.id=allocation.payment_id);
insert into payment.refund(id,payment_id,provider,provider_reference,external_transaction,idempotency_key,amount_minor,currency,state,reason,version)
select source.id,source.payment_id,coalesce(payment.attempt.provider,'unknown'),coalesce((select command.out_refund_no from public.wechat_refund_commands command
  where command.refund_id=source.id order by command.created_at desc limit 1),upper(substr(encode(digest('legacy-refund:'||source.id::text,'sha256'),'hex'),1,48))),
  null,source.idempotency_key,source.amount_cents,'CNY',
  case source.status when 'created' then 'requested' when 'processing' then 'processing' when 'succeeded' then 'succeeded' else 'failed' end,source.reason,0
from public.refunds source join payment.payment on payment.id=source.payment_id left join payment.attempt on payment.attempt.intent_id=payment.intent_id;
update payment.refund target set provider='wechat',external_transaction=source.provider_refund_id,
  state=case source.status when 'requested' then 'requested' when 'processing' then 'processing'
    when 'provider_succeeded' then 'processing' when 'succeeded' then 'succeeded' when 'provider_closed' then 'failed'
    when 'closed' then 'cancelled' else 'failed' end
from public.wechat_refund_commands source where target.id=source.refund_id;
insert into payment.refundcommand(id,refund_id,aftersale_id,order_id,attempt_id,external_refund_number,external_trade_number,transaction_id,payment_total_minor,next_operation,provider_state,provider_refund_id,provider_request_id,attempts,state,available_at,error_code,completed_at,idempotency_key,request_hash,created_at,updated_at)
select source.id::text,source.refund_id,source.after_sale_id,source.order_id,source.payment_attempt_id::text,source.out_refund_no,source.out_trade_no,
  source.transaction_id,source.payment_total_cents,source.next_operation,source.provider_status,source.provider_refund_id,source.provider_request_id,
  source.attempts,source.status,source.available_at,source.last_error_code,source.completed_at,source.idempotency_key,source.request_hash,
  source.created_at,source.updated_at from public.wechat_refund_commands source;
insert into payment.providerattempt(id,refund_id,sequence,operation,worker_id,outcome,provider_state,provider_reference,request_id,error_code,started_at,completed_at)
select source.id::text,command.refund_id,source.attempt_no,source.operation,source.worker_id,source.outcome,source.provider_status,
  source.provider_refund_id,source.provider_request_id,source.error_code,source.started_at,source.completed_at
from public.wechat_refund_provider_attempts source join public.wechat_refund_commands command on command.id=source.command_id;

insert into payment.effect(id,order_id,payment_id,kind,state,payload,available_at,attempts,error_code,completed_at,deadlettered_at,created_at,updated_at)
select source.id::text,source.order_id,source.payment_id,source.effect_type,
  case source.status when 'dead_letter' then 'deadletter' else source.status end,source.payload_json,source.available_at,source.attempts,
  source.last_error_code,source.completed_at,source.dead_lettered_at,source.created_at,source.updated_at from public.payment_event_effects source;
insert into payment.capture(id,scope_id,mall_id,member_id,order_id,source,currency,amount_minor,state,idempotency_key,completed_at,created_at)
select source.id::text,source.tenant_id,source.mall_id,coalesce(member.id,'member-'||source.user_id),source.order_id,source.source,
  source.currency,source.amount_cents,source.status,source.idempotency_key,source.completed_at,source.created_at
from public.payment_intents source left join public.members member on member.user_id=source.user_id;
insert into payment.deadletterreview(id,deadletter_id,payment_id,refund_id,decision,evidence,reviewed_by,reviewed_at)
select source.id::text,source.event_id::text,outbox.payment_id,null,source.decision,
  jsonb_build_object('reason',source.reason,'evidenceHash',source.evidence_digest,'traceId',source.request_id),source.actor_membership_id,source.created_at
from public.payment_deadletter_reviews source join public.payment_outbox outbox on outbox.id=source.event_id;
insert into payment.recoverycase(id,scope_id,order_id,resource_type,resource_id,severity,state,error_code,evidence,occurrence_count,opened_at,resolved_at,resolution_request_id)
select source.id::text,source.mall_id,source.order_id,source.resource_type,source.resource_id,source.severity,source.status,source.error_code,
  source.details_json,source.occurrence_count,source.opened_at,source.resolved_at,source.resolution_request_id from public.payment_operations_alerts source;
insert into payment.recoveryrequest(id,case_id,scope_id,actor_id,membership_id,reason,evidence_hash,trace_id,created_at)
select source.id::text,alert.id::text,source.mall_id,source.actor_member_id,source.actor_membership_id,source.reason,source.evidence_digest,
  source.request_id,source.created_at from public.payment_recovery_requests source
left join public.payment_operations_alerts alert on alert.resource_type=source.resource_type and alert.resource_id=source.resource_id;

insert into benefit.account(id,member_id,scope_id,kind,currency,status,version)
select source.id,coalesce(member.id,'member-'||source.user_id),source.mall_id,source.account_type,'CNY',source.status,source.version from public.welfare_accounts source left join public.members member on member.user_id=source.user_id;
insert into benefit.entry(id,account_id,kind,amount_minor,reference_type,reference_id,occurred_at)
select 'ledger:'||source.id,source.account_id,case source.direction when 'credit' then 'grant' else 'consume' end,
  case source.direction when 'credit' then source.amount_cents else -source.amount_cents end,
  source.business_type,source.business_id,source.created_at from public.account_ledgers source;
insert into benefit.entry(id,account_id,kind,amount_minor,reference_type,reference_id,occurred_at)
select 'adjustment:'||account.id,account.id,'adjust',account.balance_cents-coalesce(ledger.total,0),'migration','public.welfare_accounts',account.updated_at
from public.welfare_accounts account left join(
  select account_id,sum(case direction when 'credit' then amount_cents else -amount_cents end) total from public.account_ledgers group by account_id
) ledger on ledger.account_id=account.id where account.balance_cents<>coalesce(ledger.total,0);

-- Preserve both the existing posted payment journals and every historical
-- welfare account movement as balanced double-entry journals.
insert into finance.account(id,scope_id,code,currency,kind,status)
select 'account:'||md5(entry.mall_id||':'||entry.account_code),entry.mall_id,entry.account_code,'CNY',
  case when entry.account_code like '%revenue%' then 'income' when entry.account_code like '%expense%' then 'expense' else 'asset' end,'active'
from public.finance_journal_entries entry group by entry.mall_id,entry.account_code;
insert into finance.account(id,scope_id,code,currency,kind,status)
select 'benefit:'||account.id,account.mall_id,'benefit.'||account.account_type||'.'||account.id,'CNY','liability','active' from public.welfare_accounts account;
insert into finance.account(id,scope_id,code,currency,kind,status)
select 'benefitoffset:'||account.mall_id,account.mall_id,'benefit.clearing','CNY','asset','active' from public.welfare_accounts account group by account.mall_id;

insert into finance.journal(id,reference_type,reference_id,currency,period,state,description,posted_at,version)
select source.id::text,'payment',source.business_reference,'CNY',to_char(source.occurred_at at time zone 'UTC','YYYY-MM'),'posted','历史支付分录',source.occurred_at,0
from public.finance_journals source;
insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at)
select source.id::text,source.journal_id::text,'account:'||md5(source.mall_id||':'||source.account_code),source.side,source.amount_cents,source.created_at
from public.finance_journal_entries source;

insert into finance.journal(id,reference_type,reference_id,currency,period,state,description,posted_at,version)
select 'legacy-ledger:'||source.id,'benefit.ledger',source.id,'CNY',to_char(source.created_at at time zone 'UTC','YYYY-MM'),'posted',
  source.business_type,source.created_at,0 from public.account_ledgers source;
insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at)
select 'legacy-ledger-benefit:'||source.id,'legacy-ledger:'||source.id,'benefit:'||source.account_id,
  case source.direction when 'credit' then 'credit' else 'debit' end,source.amount_cents,source.created_at from public.account_ledgers source;
insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at)
select 'legacy-ledger-offset:'||source.id,'legacy-ledger:'||source.id,'benefitoffset:'||source.mall_id,
  case source.direction when 'credit' then 'debit' else 'credit' end,source.amount_cents,source.created_at from public.account_ledgers source;

-- Voucher ciphertext is prepared by the offline KMS migration step. A missing,
-- malformed or incomplete secure stage blocks the cutover instead of copying
-- legacy plaintext into the target model.
do $$ begin
  if (select count(*) from runtime.vouchersecretstage)<>(select count(*) from public.vouchers)
     or exists(select 1 from public.vouchers source left join runtime.vouchersecretstage stage on stage.voucher_id=source.id where stage.voucher_id is null)
  then raise exception 'VOUCHER_SECURE_STAGE_INCOMPLETE'; end if;
end $$;
insert into voucher.program(id,scope_id,name,value_minor,default_valid_days,currency,status,approval_required,version)
select source.id,source.mall_id,source.name,source.denomination_cents,source.default_valid_days,'CNY',
  case source.status when 'active' then 'active' when 'suspended' then 'paused' when 'retired' then 'retired' else 'draft' end,
  true,source.rule_version from public.voucher_programs source;
insert into voucher.reserverequest(id,request_number,scope_id,program_id,requested_count,requested_minor,reason,state,requested_by,submitted_at,resolved_at,resolved_by,created_at,updated_at)
select source.id,source.request_no,source.mall_id,source.voucher_program_id,source.requested_quantity,source.requested_value_cents,
  source.reason,source.status,source.requested_by_user_id,source.submitted_at,source.resolved_at,source.resolved_by_user_id,source.created_at,source.updated_at
from public.voucher_reserve_requests source;
insert into voucher.approval(id,request_id,sequence,decision,reason,evidence,actor_id,membership_id,grant_evidence,trace_id,occurred_at)
select source.id,source.reserve_request_id,source.approval_node,source.decision,source.reason,source.evidence,source.actor_user_id,
  source.actor_membership_id,source.granted_via,source.request_id,source.created_at from public.voucher_approval_actions source;
insert into voucher.cardpool(id,scope_id,code_prefix,next_sequence,provider,status,version)
select source.id,source.tenant_id,source.code_prefix,source.next_sequence,null,
  case source.status when 'active' then 'ready' when 'exhausted' then 'depleted' else 'disabled' end,0 from public.voucher_card_pools source;
insert into voucher.issuebatch(id,program_id,cardpool_id,state,requested_count,issued_count,created_at)
select source.id,source.voucher_program_id,source.card_pool_id,
  case source.status when 'issuing' then 'issuing' when 'issued' then 'completed' when 'failed' then 'failed' when 'closed' then 'completed' else 'draft' end,
  source.issued_quantity,case when source.status in('issued','closed') then source.issued_quantity else 0 end,source.created_at from public.voucher_issue_batches source;
insert into voucher.voucher(id,program_id,batch_id,member_id,code_ciphertext,code_fingerprint,code_key_version,initial_minor,remaining_minor,state,expires_at,version)
select source.id,source.voucher_program_id,source.issue_batch_id,member.id,stage.code_ciphertext,stage.code_fingerprint,stage.key_version,
  source.initial_cents,source.remaining_cents,
  case source.status when 'inactive' then 'created' when 'active' then case when member.id is null then 'active' else 'bound' end when 'disabled' then 'void' else source.status end,
  source.expires_at,source.version from public.vouchers source join runtime.vouchersecretstage stage on stage.voucher_id=source.id
  left join public.members member on member.user_id=source.bound_user_id;
insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
select source.voucher_id,row_number() over(partition by source.voucher_id order by source.created_at,source.id),source.status_before,source.status_after,
  source.reason,coalesce(source.actor_membership_id,source.actor_user_id,'system'),source.created_at from public.voucher_status_events source;
insert into verification.session(id,scope_id,subject_type,subject_id,purpose,state,expires_at,version)
select 'legacy-verification:'||source.id,program.scope_id,'voucher',source.voucher_id,'voucher_redemption','verified',source.created_at+interval '100 years',0
from public.voucher_redemptions source join public.vouchers legacy on legacy.id=source.voucher_id
join voucher.program program on program.id=legacy.voucher_program_id;
insert into voucher.redemption(id,voucher_id,verification_id,order_id,amount_minor,redeemed_at,reversed_at,version)
select source.id,source.voucher_id,'legacy-verification:'||source.id,null,source.amount_cents,source.created_at,reversal.resolved_at,0
from public.voucher_redemptions source left join public.voucher_redemption_reversals reversal on reversal.redemption_id=source.id and reversal.status='reversed';
insert into voucher.reversal(id,redemption_id,amount_minor,state,reason,evidence,occurred_at)
select source.id,source.redemption_id,source.amount_cents,source.status,source.reason,
  jsonb_build_object('requestId',source.request_id,'actorId',source.requested_by_user_id),coalesce(source.resolved_at,source.created_at)
from public.voucher_redemption_reversals source;
insert into voucher.hold(id,voucher_id,amount_minor,state,reason,reconciliation_reference,evidence,created_at,reconciled_at)
select source.id,source.voucher_id,source.amount_cents,source.status,source.void_reason,source.reconciliation_reference,
  jsonb_build_object('voidRequestId',source.void_request_id,'reconciliationRequestId',source.reconciliation_request_id),source.created_at,source.reconciled_at
from public.voucher_void_balance_holds source;

insert into runtime.idempotency(scope,actor_id,key,request_hash,state,response,created_at,expires_at)
select source.scope,source.tenant_id,source.idempotency_key,
  case when source.request_hash~'^[0-9a-f]{64}$' then source.request_hash else encode(digest(source.request_hash,'sha256'),'hex') end,
  'completed',source.response_json,source.created_at,source.expires_at from public.idempotency_keys source;
insert into runtime.idempotency(scope,actor_id,key,request_hash,state,response,created_at,expires_at)
select 'organization.distributor.'||source.action,source.actor_membership_id,source.idempotency_key,
  case when source.request_hash~'^[0-9a-f]{64}$' then source.request_hash else encode(digest(source.request_hash,'sha256'),'hex') end,
  'completed',source.response_json,source.created_at,source.created_at+interval '100 years' from public.distributor_operation_keys source
where not exists(select 1 from runtime.idempotency target where target.scope='organization.distributor.'||source.action
  and target.actor_id=source.actor_membership_id and target.key=source.idempotency_key);

insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at,claimed_by,claim_until,attempts,published_at)
select 'legacy-payment:'||source.id::text,
  case source.topic when 'order.payment_succeeded' then 'payment.succeeded' else 'order.cancelled' end,1,'payment',coalesce(source.payment_id,source.payment_intent_id::text),
  source.tenant_id,source.payload_json,source.event_key,source.created_at,source.available_at,null,null,source.delivery_attempts,source.delivered_at
from public.payment_outbox source
where source.topic in('order.payment_succeeded','order.payment_terminal');
insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at,claimed_by,claim_until,attempts,published_at)
select 'legacy-refund:'||source.id::text,'payment.refunded',source.event_version,source.aggregate_type,source.aggregate_id,source.tenant_id,
  source.payload_json,source.event_key,source.created_at,source.available_at,null,null,source.attempts,source.delivered_at
from public.wechat_refund_event_outbox source where source.event_type='RefundSucceeded';
insert into runtime.inbox(consumer,event_id,event_type,event_version,trace_id,payload,received_at,processed_at,attempts)
select source.consumer,'legacy-payment:'||source.outbox_id::text,
  case outbox.topic when 'order.payment_succeeded' then 'payment.succeeded' when 'order.payment_terminal' then 'order.cancelled' else 'payment.succeeded' end,
  1,source.event_key,jsonb_build_object('aggregateId',source.aggregate_id,'aggregateVersion',source.aggregate_version,'payloadHash',source.payload_digest),
  source.consumed_at,source.consumed_at,1 from public.payment_event_inbox source join public.payment_outbox outbox on outbox.id=source.outbox_id;
insert into runtime.inbox(consumer,event_id,event_type,event_version,trace_id,payload,received_at,processed_at,attempts)
select source.consumer,'legacy-refund:'||source.outbox_id::text,'payment.refunded',1,source.event_key,
  jsonb_build_object('payloadHash',source.payload_digest),source.consumed_at,source.consumed_at,1
from public.wechat_refund_event_inbox source;
insert into runtime.inbox(consumer,event_id,event_type,event_version,trace_id,payload,received_at,processed_at,attempts)
select 'wechat.refund.notification','legacy-refund-notification:'||source.id::text,'payment.refunded',1,source.notification_id,
  jsonb_build_object('commandId',source.command_id,'eventType',source.event_type,'evidenceHash',source.evidence_digest),
  source.received_at,source.received_at,1 from public.wechat_refund_notification_inbox source;
insert into runtime.deadletter(id,kind,source_id,owner,payload,error_code,attempts,failed_at,reviewed_at)
select 'legacy-reconciliation:'||source.id::text,'event',source.event_key,'payment',source.payload_json,
  coalesce(source.last_error_code,'PAYMENT_RECONCILIATION_REQUIRED'),greatest(source.delivery_attempts,1),coalesce(source.delivered_at,source.updated_at),null
from public.payment_outbox source where source.topic='order.payment_reconciliation_required';
insert into runtime.deadletter(id,kind,source_id,owner,payload,error_code,attempts,failed_at,reviewed_at)
select 'legacy-refund-closed:'||source.id::text,'event',source.event_key,'payment',source.payload_json,
  coalesce(source.last_error_code,'REFUND_CLOSED'),greatest(source.attempts,1),coalesce(source.dead_lettered_at,source.created_at),null
from public.wechat_refund_event_outbox source where source.event_type='RefundClosed';

insert into audit.record(id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,trace_id,previous_hash,record_hash,recorded_at)
select source.id,source.tenant_id,source.actor_user_id,source.actor_type,source.action,source.resource_type,source.resource_id,
  case when source.before_json is null then null else encode(digest(source.before_json::text,'sha256'),'hex') end,
  case when source.after_json is null then null else encode(digest(source.after_json::text,'sha256'),'hex') end,
  jsonb_build_object('source','public.audit_logs','requestId',source.request_id),source.request_id,null,
  encode(digest(source.id||':'||source.request_id||':'||source.created_at::text,'sha256'),'hex'),source.created_at from public.audit_logs source;

insert into reporting.orderprojection(order_id,scope_id,order_number,payment_state,fulfillment_state,aftersale_state,lifecycle_state,total_minor,currency,occurred_at,snapshot,watermark,projection_version)
select id,scope_id,order_number,payment_state,fulfillment_state,aftersale_state,lifecycle_state,total_minor,currency,created_at,
  jsonb_build_object('source','legacycutover'),updated_at,0 from ordering.orderrecord;
insert into reporting.financeprojection(statement_id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,credit_minor,closing_minor,state,watermark,projection_version)
select id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,credit_minor,closing_minor,state,generated_at,0 from finance.statement;

insert into risk.policy(id,scope_id,name,active_version,status)
values('riskpolicy:identity','identity','Identity baseline',1,'active') on conflict(id) do nothing;
insert into risk.policyversion(policy_id,version,rule,rule_hash)
values('riskpolicy:identity',1,'{}'::jsonb,encode(digest('{}','sha256'),'hex')) on conflict(policy_id,version) do nothing;

commit;
