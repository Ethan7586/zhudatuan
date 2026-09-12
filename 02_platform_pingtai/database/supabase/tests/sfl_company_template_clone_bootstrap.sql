insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
values('principal:company-clone-source','active',1,clock_timestamp(),clock_timestamp(),0);

insert into identity.account(id,realm_id,legacy_principal_id,status,credential_version,assurance_level,created_at,updated_at,version)
values('account:company-clone-source','realm:l0','principal:company-clone-source','active',1,2,
  clock_timestamp(),clock_timestamp(),0);

insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id)
values('credential:company-clone-source','principal:company-clone-source','password',
  encode(public.digest('company-clone-source-subject','sha256'),'hex'),'fixture-source-secret-hash','active',
  clock_timestamp(),'realm:l0','account:company-clone-source');

insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
values('member:company-clone-source','principal:company-clone-source','公司克隆源所有者','active',
  clock_timestamp(),clock_timestamp(),0);

insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at,
  realm_id,account_id,node_profile)
values('membership:company-clone-source','member:company-clone-source','mall-zhudatuan','operator','active',1,
  clock_timestamp(),'realm:l0','account:company-clone-source','operating_mall');

insert into catalog.pool(id,scope_id,kind,name,status,version)
select binding.pool_id,binding.mall_id,'private','公司克隆源模板商品池','active',0
from experience.binding binding
where binding.mall_id='mall-zhudatuan'
  and not exists(select 1 from catalog.pool current where current.id=binding.pool_id)
limit 1;

insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at)
select binding.mall_id,binding.pool_id,'selected','active',clock_timestamp(),clock_timestamp()
from experience.binding binding
where binding.mall_id='mall-zhudatuan'
  and not exists(select 1 from catalog.poolbinding current
    where current.mall_id=binding.mall_id and current.pool_id=binding.pool_id)
limit 1;
